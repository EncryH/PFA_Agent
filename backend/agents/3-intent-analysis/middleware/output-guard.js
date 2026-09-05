const INTERNAL_DISCLOSURE = /(?:system\s*prompt|developer\s*message|GEMINI_API_KEY|NEO4J_PASSWORD|SUPABASE_DATABASE_URL|BEGIN\s+(?:SYSTEM|DEVELOPER)\s+PROMPT)/i;
const MAX_OUTPUT_LENGTH = 1600;

export function guardOutput(text, fallbackMessage) {
  const value = String(text || "").trim();
  if (!value || INTERNAL_DISCLOSURE.test(value)) return fallbackMessage;
  return value.length > MAX_OUTPUT_LENGTH ? fallbackMessage : value;
}

export function guardIntentResult(result = {}) {
  const fallback = "안전 확인에 필요한 내용만 안내해 드릴게요.";
  return {
    ...result,
    message: guardOutput(result.message, fallback),
  };
}
