// 2층 행동 감지 신호 카탈로그 — 4층(4-intent-analysis/rules/signals.js)과 같은 형태다.
// "코드 → {점수, 설명}" 표로 신호를 선언하고, 원시 행동 데이터에서 코드를 뽑아
// 채점하는 두 단계로 나눈다. 부모가 무엇을 입력하지 않아도 앱 안 행동만으로 작동하는
// 것이 이 계층의 존재 이유다. 규칙 기반이며 LLM을 쓰지 않는다.

export const SIGNALS = Object.freeze({
  // 적금·예금 중도해지 — 사기범이 노후자금을 끌어내는 전형적인 경로
  SAVINGS_CLOSE_MULTIPLE: { score: 80, label: "예·적금 복수 중도해지 후 즉시 이체" },
  SAVINGS_CLOSE_ONCE:     { score: 55, label: "적금·예금 중도해지 직후 이체 시도 — 보이스피싱 전형 패턴" },

  // 이체한도 상향 — 사기범이 안전장치(한도)를 먼저 풀게 만드는 전형적인 경로.
  // 55점을 줘서 이 신호 하나만으로도 경계(C) 등급 문턱(51점)을 넘게 한다 — "확인" 한 번으로
  // 통과되는 B등급으로 새 나가면 안 되는 신호이기 때문이다.
  LIMIT_INCREASED: { score: 55, label: "이체한도 상향 직후 송금 시도 — 보이스피싱 전형 패턴" },

  // 잔액 반복 조회 — 통화 지시에 따라 자금을 확인하는 행동
  BALANCE_CHECK_REPEATED: { score: 28, label: null }, // label 은 조회 횟수를 넣어 동적으로 만든다
  BALANCE_CHECK_ONCE:     { score: 15, label: "잔액 반복 조회" },

  VERIFY_SKIPPED: { score: 8, label: "상대방 검증 미실시" },

  // 앱을 열고 곧바로 이체 — 사기범이 재촉하는 상황
  SESSION_VERY_FAST: { score: 18, label: "매우 빠른 이체 시도" }, // 15초 미만
  SESSION_FAST:       { score: 8,  label: null },                  // 30초 미만 — 기존 코드도 라벨 없음

  // 송금 단계를 반복해서 되돌아감 — 통화로 지시받은 내용을 다시 확인·정정하며 진행하는
  // 정황일 수 있다. backPresses 는 프론트가 이미 수집해 보내고 있었지만 채점되지 않던 신호다.
  BACK_NAV_REPEATED: { score: 20, label: "송금 단계를 5회 이상 되돌아감 — 지시에 따라 재입력하는 정황" },
  BACK_NAV_SOME:      { score: 12, label: "송금 단계를 반복해서 되돌아감" },

  // 통화 중 송금 — 사기범이 전화를 끊지 못하게 붙잡아둔 채 지시하는 전형적인 방식
  ON_CALL: { score: 45, label: "통화 중 송금 시도 — 통화 상대의 지시에 따라 송금 중일 가능성" },
  // 10분 내 통화 기록이 있고, 이번 송금이 그 통화와 관련 있다고 스스로 확인한 경우
  RECENT_CALL_LINKED: { score: 35, label: "최근 통화와 관련된 송금이라고 확인함" },
  // 통화 내용 자체에서 구체적인 송금 요구가 확인된 경우 — 자기 신고가 아니라 통화
  // 내용에서 직접 잡힌 신호라 가장 확실하다
  CALL_TRANSFER_REQUEST: { score: 50, label: "통화 중 구체적인 송금 요구가 감지됨 — 통화 상대가 직접 송금을 지시한 정황" },
});

export const SIGNAL_CODES = Object.keys(SIGNALS);

/** 원시 행동 데이터 → 신호 코드 배열. 규칙 기반, LLM 없음. */
export function extractSignals({
  savingsEarlyClose = 0,
  limitIncreased = 0,
  historyVisits = 0,
  verifyVisited = false,
  sessionSeconds = 999,
  backPresses = 0,
  isOnCall = false,
  recentCallLinked = false,
  callTransferRequestDetected = false,
} = {}) {
  const codes = [];

  const closureCount = Number(savingsEarlyClose ?? 0);
  if (closureCount >= 2) codes.push("SAVINGS_CLOSE_MULTIPLE");
  else if (closureCount === 1) codes.push("SAVINGS_CLOSE_ONCE");

  if (Number(limitIncreased ?? 0) >= 1) codes.push("LIMIT_INCREASED");

  const visits = Number(historyVisits ?? 0);
  if (visits >= 3) codes.push("BALANCE_CHECK_REPEATED");
  else if (visits >= 1) codes.push("BALANCE_CHECK_ONCE");

  if (!verifyVisited) codes.push("VERIFY_SKIPPED");

  const sec = Number(sessionSeconds ?? 999);
  if (sec < 15) codes.push("SESSION_VERY_FAST");
  else if (sec < 30) codes.push("SESSION_FAST");

  const backs = Number(backPresses ?? 0);
  if (backs >= 5) codes.push("BACK_NAV_REPEATED");
  else if (backs >= 2) codes.push("BACK_NAV_SOME");

  if (isOnCall) codes.push("ON_CALL");
  if (recentCallLinked) codes.push("RECENT_CALL_LINKED");
  if (callTransferRequestDetected) codes.push("CALL_TRANSFER_REQUEST");

  return codes;
}

/** 신호 코드 배열 → 점수·근거. BALANCE_CHECK_REPEATED 는 조회 횟수를 라벨에 넣어야 해서
 *  historyVisits 원본값도 함께 받는다(카탈로그의 정적 label 로는 표현이 안 되는 유일한 신호). */
export function scoreSignals(codes = [], { historyVisits = 0 } = {}) {
  const valid = [...new Set(codes)].filter((c) => c in SIGNALS);
  const score = valid.reduce((sum, c) => sum + SIGNALS[c].score, 0);
  const reasons = valid
    .map((c) => (c === "BALANCE_CHECK_REPEATED" ? `잔액 ${historyVisits}회 반복 조회` : SIGNALS[c].label))
    .filter(Boolean);
  return { score, codes: valid, reasons };
}
