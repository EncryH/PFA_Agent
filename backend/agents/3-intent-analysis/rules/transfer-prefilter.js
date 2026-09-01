/**
 * 사기 송금 의도 분석에 들어가기 전 실행하는 빠른 거래 신호 검사다.
 *
 * 별도 에이전트나 사용자 노출 단계가 아니며, 현재 거래만으로 즉시 확인할 수 있는
 * 고액·신규 수취인·심야 송금 신호를 계산한다. 이후 3단계의 Supabase 개인 거래
 * 패턴 조회와 대화 분석이 더 풍부한 근거로 최종 판단한다.
 */
export function evaluateTransferPrefilter({
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

  if (!isKnownRecipient && !isMyAccount) {
    score += 20;
    reasons.push("미등록 수취인");
  }

  const hour = Number(hourOfDay ?? 12);
  if (hour < 6 || hour >= 23) {
    score += 15;
    reasons.push("야간 이체");
  }

  return { evaluated: true, score, reasons };
}
