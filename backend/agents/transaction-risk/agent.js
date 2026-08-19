import { AGENT_STATUS } from "../shared.js";

export const metadata = Object.freeze({
  layer: 3,
  key: "transaction-risk",
  name: "거래 검사",
  status: AGENT_STATUS.READY,
});

/**
 * 이 거래가 평소와 다른지만 본다. 송금 이유는 4층이 다룬다.
 *
 * 0점이면 이후 계층을 실행하지 않는다 — 정상 거래의 무마찰을 보장하는 지점이다.
 * 점수만 반환하고 등급 판정은 오케스트레이터가 한다.
 */
export function runTransactionRiskAgent({
  amount = 0,
  isKnownRecipient = false,
  isMyAccount = false,
  hourOfDay = 12,
} = {}) {
  const reasons = [];
  let score = 0;

  const amt = Number(amount ?? 0);
  if (amt >= 30_000_000) {
    score += 35;
    reasons.push("고액 이체 (3천만원 이상)");
  } else if (amt >= 10_000_000) {
    score += 25;
    reasons.push("고액 이체 (1천만원 이상)");
  } else if (amt >= 3_000_000) {
    score += 15;
    reasons.push("고액 이체 (300만원 이상)");
  } else if (amt >= 1_000_000) {
    score += 8;
  }

  // 본인 명의 계좌로 보내는 건 사기가 성립하지 않는다
  if (!isKnownRecipient && !isMyAccount) {
    score += 20;
    reasons.push("미등록 수취인");
  }

  const hour = Number(hourOfDay ?? 12);
  if (hour < 6 || hour >= 23) {
    score += 15;
    reasons.push("야간 이체");
  }

  return { agent: metadata.key, layer: metadata.layer, evaluated: true, score, reasons };
}
