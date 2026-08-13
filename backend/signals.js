// 4층 위험 채점 규칙
//
// 설계 원칙: "Rules decide, AI explains"
//   - LLM은 대화에서 신호를 '추출'만 한다 (아래 코드 중에서 고르기)
//   - 점수 계산과 보류 판정은 오직 이 파일이 한다
//   - 서버에서만 실행된다 — 클라이언트가 점수를 조작할 수 없다

export const SIGNALS = {
  // 단독으로도 사기가 확실한 신호 — 정상 거래에서는 나타날 수 없다
  SAFE_ACCOUNT_TRANSFER:       { score: 50, label: "안전계좌 이동 유도" },
  SECRECY_INSTRUCTION:         { score: 40, label: "가족에게 알리지 말라는 지시" },

  PREPAY_CONTRADICTION:        { score: 30, label: "선입금 모순" },
  CREDENTIAL_REQUEST:          { score: 30, label: "인증정보·원격앱 요구" },
  CALL_IN_PROGRESS:            { score: 30, label: "통화 중 송금" },
  AGENCY_IMPERSONATION:        { score: 25, label: "기관 사칭" },
  PERSONAL_ACCOUNT_FOR_AGENCY: { score: 25, label: "기관 요구·개인 계좌" },
  EVASIVE:                     { score: 20, label: "확인 회피" },
  URGENCY:                     { score: 15, label: "긴급성 강요" },
};

export const SIGNAL_CODES = Object.keys(SIGNALS);

export const HOLD_THRESHOLD = 50;  // 이상이면 5층 가족 확인으로
export const MAX_TURNS = 4;        // 질문 상한 — 부모님을 지치게 하지 않는다

/** 추출된 신호 코드 배열 → 점수·등급·라벨 */
export function scoreSignals(codes = []) {
  const valid = codes.filter((c) => c in SIGNALS);
  const score = valid.reduce((sum, c) => sum + SIGNALS[c].score, 0);
  return {
    score,
    labels: valid.map((c) => SIGNALS[c].label),
    level: score >= HOLD_THRESHOLD ? "HIGH" : score >= 30 ? "MEDIUM" : "LOW",
  };
}
