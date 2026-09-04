/**
 * 안심동행 프로토타입이 직접 만든 브라우저 저장정보만 삭제한다.
 * 같은 출처에서 다른 서비스가 localStorage를 함께 쓰더라도 영향을 주지 않도록
 * localStorage.clear() 대신 허용 목록을 사용한다.
 */
export const ANSIM_LOCAL_STORAGE_KEYS = [
  "ansimEmergencyReceipts",
  "ansimNotices",
  "ansimLargeText",
  "ansimIntentChatsV1",
  "ansimInquiriesV1",
  "ansimProtectionLevel",
  "ansimAiReviewThreshold",
  "ansimGuardianLogV1",
  "ansimAlert",
  "ansimPairCode",
  "ansimPaired",
  "ansimPairedAt",
  "ansimTransactionHistoryStatusV2",
  "ansimCooldownUntil",
  "ansimPortfolio_parent",
  "ansimPortfolio_child",
  "ansimLastCallAt",
] as const;

export function maskAccountForFamily(value: string, bank = "") {
  if (/끝\s*\d{1,4}자리/.test(value)) return value;
  const digits = String(value).replace(/\D/g, "");
  const label = bank || String(value).trim().split(/\s+/)[0] || "수취 계좌";
  return digits ? `${label} 끝 ${digits.slice(-4)}자리` : `${label} 수취 계좌`;
}

export function clearAnsimLocalData() {
  for (const key of ANSIM_LOCAL_STORAGE_KEYS) localStorage.removeItem(key);
  window.dispatchEvent(new Event("ansim-paired"));
  window.dispatchEvent(new Event("ansim-alert"));
  window.dispatchEvent(new Event("ansim-intent-chat-updated"));
  window.dispatchEvent(new Event("ansim-guardian-log"));
  window.dispatchEvent(new Event("ansim-emergency-receipts"));
  window.dispatchEvent(new Event("ansim-inquiry"));
  window.dispatchEvent(new Event("ansim-protection-level"));
  window.dispatchEvent(new Event("ansim-ai-review-threshold"));
  window.dispatchEvent(new Event("ansim-cooldown"));
  window.dispatchEvent(new Event("ansim-privacy-reset"));
}
