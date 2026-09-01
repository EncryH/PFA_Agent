// 3층 거래 검사 신호 카탈로그 — 2층·4층과 같은 "코드 → {점수, 설명}" 형태.
// 이 거래가 평소와 다른지만 본다. 송금 이유는 4층이 다룬다.
// 규칙 기반이며 LLM을 쓰지 않는다.

export const SIGNALS = Object.freeze({
  AMOUNT_TIER_3: { score: 35, label: "고액 이체 (3천만원 이상)" },
  AMOUNT_TIER_2: { score: 25, label: "고액 이체 (1천만원 이상)" },
  AMOUNT_TIER_1: { score: 15, label: "고액 이체 (300만원 이상)" },
  // 100만원대는 점수만 붙고 화면에 노출할 근거 문구는 없다 — 이 금액대만으로 "고액"이라고
  // 부르기엔 이르다는 기존 판단을 그대로 유지한다.
  AMOUNT_TIER_0: { score: 8, label: null },

  // 본인 명의 계좌로 보내는 건 사기가 성립하지 않는다 — isMyAccount 는 이 신호를 막는다.
  UNREGISTERED_RECIPIENT: { score: 20, label: "미등록 수취인" },

  NIGHT_TRANSFER: { score: 15, label: "야간 이체" },
});

export const SIGNAL_CODES = Object.keys(SIGNALS);

/** 원시 거래 데이터 → 신호 코드 배열. 규칙 기반, LLM 없음. */
export function extractSignals({
  amount = 0,
  isKnownRecipient = false,
  isMyAccount = false,
  hourOfDay = 12,
} = {}) {
  const codes = [];

  const amt = Number(amount ?? 0);
  if (amt >= 30_000_000) codes.push("AMOUNT_TIER_3");
  else if (amt >= 10_000_000) codes.push("AMOUNT_TIER_2");
  else if (amt >= 3_000_000) codes.push("AMOUNT_TIER_1");
  else if (amt >= 1_000_000) codes.push("AMOUNT_TIER_0");

  if (!isKnownRecipient && !isMyAccount) codes.push("UNREGISTERED_RECIPIENT");

  const hour = Number(hourOfDay ?? 12);
  if (hour < 6 || hour >= 23) codes.push("NIGHT_TRANSFER");

  return codes;
}

/** 신호 코드 배열 → 점수·근거(label 이 없는 신호는 점수만 반영되고 근거 목록엔 안 뜬다). */
export function scoreSignals(codes = []) {
  const valid = [...new Set(codes)].filter((c) => c in SIGNALS);
  const score = valid.reduce((sum, c) => sum + SIGNALS[c].score, 0);
  const reasons = valid.map((c) => SIGNALS[c].label).filter(Boolean);
  return { score, codes: valid, reasons };
}
