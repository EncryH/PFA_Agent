import { normalizeSituation } from "../../../../shared/conversation-state.js";
import { sanitizeText } from "../sanitize.js";
const MAX_MESSAGES = 80;
const MAX_MESSAGE_LENGTH = 2_000;

export function normalizeText(value = "") {
  return String(value)
    .normalize("NFKC")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g, "")
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normalizeRequest(input = {}) {
  const sourceMessages = Array.isArray(input.messages) ? input.messages : [];
  const sourceConversationState = input.conversationState || {};
  const flags = [];

  if (sourceMessages.length > MAX_MESSAGES) flags.push("MESSAGE_COUNT_LIMIT");
  if (sourceMessages.some((message) => String(message?.text || "").length > MAX_MESSAGE_LENGTH)) {
    flags.push("MESSAGE_LENGTH_LIMIT");
  }

  const messages = sourceMessages.slice(-MAX_MESSAGES).map((message) => ({
    role: message?.role === "ai" ? "ai" : "user",
    text: normalizeText(message?.text || "").slice(0, MAX_MESSAGE_LENGTH),
  }));
  const conversationState = {
    resumed: sourceConversationState.resumed === true,
    analysisDone: sourceConversationState.analysisDone === true,
    analysisHold: sourceConversationState.analysisHold === true,
    situation: normalizeSituation(sourceConversationState.situation),
    fraudTypeLabel: normalizeText(sourceConversationState.fraudTypeLabel || "").slice(0, 80),
    riskLabels: Array.isArray(sourceConversationState.riskLabels)
      ? sourceConversationState.riskLabels.slice(0, 8).map((label) => normalizeText(label).slice(0, 80))
      : [],
  };
  for (const fact of Object.values(conversationState.situation.facts)) fact.evidence = sanitizeText(fact.evidence);

  return {
    input: {
      ...input,
      messages,
      conversationState,
      turn: Math.max(1, Number(input.turn) || 1),
    },
    flags,
  };
}

export function lastUserText(messages = []) {
  return [...messages].reverse().find((message) => message.role !== "ai")?.text || "";
}
