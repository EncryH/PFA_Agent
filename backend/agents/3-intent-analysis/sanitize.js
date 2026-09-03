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

function accountReference(value = "") {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `acct_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function safeTransferContext(transfer = {}) {
  const amount = Number(transfer.amount) || 0;
  const requestedUserId = String(transfer.userId || transfer.user_id || "");
  return {
    user_id: /^demo-parent-0[1-3]$/.test(requestedUserId) ? requestedUserId : "demo-parent-01",
    account_id: String(transfer.sourceAccount || transfer.account_id || "1101234567").replace(/\D/g, "").slice(0, 14),
    occurred_at: Number.isNaN(new Date(transfer.occurredAt || transfer.occurred_at).getTime())
      ? new Date().toISOString()
      : new Date(transfer.occurredAt || transfer.occurred_at).toISOString(),
    amount,
    amount_band: amount >= 3_000_000 ? "300만원 이상"
      : amount >= 1_000_000 ? "100만원 이상"
      : amount >= 300_000 ? "30만원 이상"
      : "30만원 미만",
    recipient_display_type: transfer.recipientName ? "개인 이름으로 표시된 계좌" : "확인되지 않음",
    recipient_account_hash: accountReference(`${String(transfer.bank || "")}:${String(transfer.recipientName || "")}`),
    is_first_transfer: transfer.isFirstTransfer !== false,
    pattern_risk_score: Number(transfer.patternRiskScore) || 0,
    reported_account: Boolean(transfer.reportedAccount),
    call_in_progress: Boolean(transfer.callInProgress),
    // 송금 전 사전 분석에서 이미 D등급(또는 강제 최고 위험)으로 확정된 상담이다.
    // 이 값이 참이면, 대화 내용이 아무리 그럴듯해도 최종 판정을 안전 쪽으로 내리지 않는다.
    forced_hold: Boolean(transfer.forcedHold),
  };
}
