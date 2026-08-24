const PATTERNS = [
  [/(?<!\d)\d{6}[- ]?[1-4]\d{6}(?!\d)/g, "[주민번호]"],
  [/(?<!\d)0\d{1,3}[- ]?\d{3,4}[- ]?\d{4}(?!\d)/g, "[전화번호]"],
  [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[이메일]"],
  [/https?:\/\/\S+|www\.\S+/gi, "[링크]"],
  [/(?<!\d)(?:\d[ -]?){10,16}(?!\d)/g, "[계좌·긴번호]"],
];

export function sanitizeText(value = "") {
  return PATTERNS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    String(value),
  ).trim();
}

export function sanitizeMessages(messages = []) {
  return messages.map((message) => ({
    role: message?.role === "ai" ? "ai" : "user",
    text: sanitizeText(message?.text || ""),
  }));
}

export function safeTransferContext(transfer = {}) {
  const amount = Number(transfer.amount) || 0;
  return {
    amount,
    amount_band: amount >= 3_000_000 ? "300만원 이상"
      : amount >= 1_000_000 ? "100만원 이상"
      : amount >= 300_000 ? "30만원 이상"
      : "30만원 미만",
    recipient_display_type: transfer.recipientName ? "개인 이름으로 표시된 계좌" : "확인되지 않음",
    is_first_transfer: transfer.isFirstTransfer !== false,
    pattern_risk_score: Number(transfer.patternRiskScore) || 0,
    reported_account: Boolean(transfer.reportedAccount),
    call_in_progress: Boolean(transfer.callInProgress),
  };
}
