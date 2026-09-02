export const ROUTES = Object.freeze({
  STATIC: "STATIC",
  GENERAL: "GENERAL",
  RISK: "RISK",
  BLOCK: "BLOCK",
});

const GREETING_PATTERN = /^(?:안녕(?:하세요|하십니까)?|반가워요?|좋은\s*(?:아침|오후|저녁)(?:이에요|입니다)?|hi|hello)[!.?\s]*$/i;
const THANKS_PATTERN = /^(?:고마워요?|감사(?:해요|합니다)?|도움이\s*됐어요|thanks?)[!.?\s]*$/i;
const GENERAL_QUESTION_PATTERN = /(?:뭐(?:야|예요|에요)|무엇|뜻|설명해|알려줘|어떻게|차이|왜|방법|기능|사용법|할\s*수\s*있)/i;
const STRONG_RISK_PATTERN = /(?:안전\s*계좌|보이스피싱|사기|검찰|경찰|금감원|국세청|OTP|인증번호|비밀번호|원격\s*제어|앱\s*설치|링크\s*클릭|가족에게\s*비밀|통화\s*중|(?:송금|입금|돈).{0,14}(?:하라|해\s*달|보내|요구|옮기|했다|했어요)|계좌.{0,14}(?:범죄|연루|동결|압류)|수수료를\s*먼저|원금\s*보장)/i;

export function hasActiveTransfer(transfer = {}) {
  return Number(transfer.amount) > 0
    || Boolean(String(transfer.account || "").trim())
    || Boolean(String(transfer.recipientName || "").trim());
}

export function classifyRoute({ text = "", activeTransfer = false, injection = {} } = {}) {
  if (injection.blocked) {
    return { route: ROUTES.BLOCK, confidence: 1, reason: "직접적인 프롬프트 인젝션 시도" };
  }
  if (injection.quoted) {
    return { route: ROUTES.RISK, confidence: 0.98, reason: "외부에서 받은 의심 문구를 비신뢰 근거로 분석" };
  }
  if (GREETING_PATTERN.test(text) || THANKS_PATTERN.test(text)) {
    return { route: ROUTES.STATIC, confidence: 0.99, reason: "단순 인사·감사 표현" };
  }
  if (STRONG_RISK_PATTERN.test(text)) {
    return { route: ROUTES.RISK, confidence: 0.97, reason: "송금·사기 위험 관련 표현" };
  }
  if (GENERAL_QUESTION_PATTERN.test(text)) {
    return { route: ROUTES.GENERAL, confidence: 0.86, reason: "일반 설명 질문" };
  }
  if (activeTransfer) {
    return { route: ROUTES.RISK, confidence: 0.9, reason: "진행 중인 송금 확인 세션" };
  }
  return { route: ROUTES.GENERAL, confidence: 0.7, reason: "위험 신호가 없는 일반 대화" };
}

export function isGreeting(text = "") {
  return GREETING_PATTERN.test(text);
}
