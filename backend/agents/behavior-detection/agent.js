import { AGENT_STATUS } from "../shared.js";

export const metadata = Object.freeze({
  layer: 2,
  key: "behavior-detection",
  name: "행동 감지",
  status: AGENT_STATUS.READY,
});

/**
 * 앱 안에서의 행동 시퀀스로 사기 통화 중인 상태를 감지한다.
 * 부모가 무엇을 입력하지 않아도 작동하는 것이 이 계층의 존재 이유다.
 *
 * 규칙 기반이며 LLM을 쓰지 않는다. 점수만 반환하고 등급 판정은 오케스트레이터가 한다.
 */
export function runBehaviorDetectionAgent({
  savingsEarlyClose = 0,
  historyVisits = 0,
  verifyVisited = false,
  sessionSeconds = 999,
} = {}) {
  const reasons = [];
  let score = 0;

  // 적금·예금 중도해지 — 사기범이 노후자금을 끌어내는 전형적인 경로
  const closureCount = Number(savingsEarlyClose ?? 0);
  if (closureCount >= 2) {
    score += 80;
    reasons.push("예·적금 복수 중도해지 후 즉시 이체");
  } else if (closureCount === 1) {
    score += 55;
    reasons.push("적금·예금 중도해지 직후 이체 시도 — 보이스피싱 전형 패턴");
  }

  // 잔액 반복 조회 — 통화 지시에 따라 자금을 확인하는 행동
  const visits = Number(historyVisits ?? 0);
  if (visits >= 3) {
    score += 28;
    reasons.push(`잔액 ${visits}회 반복 조회`);
  } else if (visits >= 1) {
    score += 15;
    reasons.push("잔액 반복 조회");
  }

  if (!verifyVisited) {
    score += 8;
    reasons.push("상대방 검증 미실시");
  }

  // 앱을 열고 곧바로 이체 — 사기범이 재촉하는 상황
  const sec = Number(sessionSeconds ?? 999);
  if (sec < 15) {
    score += 18;
    reasons.push("매우 빠른 이체 시도");
  } else if (sec < 30) {
    score += 8;
  }

  return { agent: metadata.key, layer: metadata.layer, evaluated: true, score, reasons };
}
