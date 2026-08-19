import type { OfficialContent } from "../api/guardian";

export type StoredChatMessage = { role: "ai" | "user"; text: string };

export type IntentChatSession = {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  updatedAt: string;
  transfer: {
    account: string;
    bank: string;
    name: string;
    amount: string;
    fromIdx: number;
  };
  messages: StoredChatMessage[];
  turnCount: number;
  riskLabels: string[];
  fraudTypeLabel: string;
  fallback: boolean;
  /**
   * 분석이 끝난 상담이면 결론과 함께 보여준 공식 자료(사례·영상)까지 남긴다.
   * 상담 기록은 '무엇을 안내받았는지'가 그대로 보존돼야 나중에 다시 확인할 수 있다.
   * 예전 스키마로 저장된 상담에는 없을 수 있으므로 선택 항목이다.
   */
  analysisDone?: boolean;
  analysisHold?: boolean;
  official?: OfficialContent | null;
};

const STORAGE_KEY = "ansimIntentChatsV1";
export const INTENT_CHAT_EVENT = "ansim-intent-chat-updated";

export function readIntentChatSessions(): IntentChatSession[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is IntentChatSession => item?.schemaVersion === 1 && typeof item?.id === "string")
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
  } catch {
    return [];
  }
}

export function readIntentChatSession(id: string) {
  return readIntentChatSessions().find((session) => session.id === id) ?? null;
}

export function saveIntentChatSession(session: IntentChatSession) {
  const previous = readIntentChatSessions().filter((item) => item.id !== session.id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([session, ...previous].slice(0, 5)));
  window.dispatchEvent(new Event(INTENT_CHAT_EVENT));
}

export function deleteIntentChatSession(id: string) {
  const remaining = readIntentChatSessions().filter((session) => session.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
  window.dispatchEvent(new Event(INTENT_CHAT_EVENT));
}
