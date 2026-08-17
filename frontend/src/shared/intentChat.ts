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
