import { isEmergencySelfReport } from "../emergency-signals.js";
import { inferDialogue } from "./dialogue.js";

export const ROUTES = Object.freeze({STATIC:"STATIC",GENERAL:"GENERAL",RISK:"RISK",BLOCK:"BLOCK",ACTION:"ACTION"});
const GREETING_PATTERN = /^(?:안녕(?:하세요|하십니까)?|반가워요?|좋은\s*(?:아침|오후|저녁)(?:이에요|입니다)?|hi|hello)[!.?\s]*$/i;
const THANKS_PATTERN = /^(?:고마워요?|감사(?:해요|합니다)?|도움이\s*됐어요|thanks?)[!.?\s]*$/i;

export function hasActiveTransfer(transfer = {}) {
  return Number(transfer.amount) > 0 || Boolean(String(transfer.account || "").trim()) || Boolean(String(transfer.recipientName || "").trim());
}

// 동기식 초기 분류. 애매한 발화의 문맥 해석은 middleware의 classifyDialogue에서 보완한다.
export function classifyRoute({text="",activeTransfer=false,injection={}} = {}) {
  if (injection.blocked) return {route:ROUTES.BLOCK,confidence:1,reason:"직접적인 프롬프트 인젝션 시도"};
  if (injection.quoted) return {route:ROUTES.RISK,confidence:.98,reason:"외부 의심 문구 분석"};
  if (GREETING_PATTERN.test(text) || THANKS_PATTERN.test(text)) return {route:ROUTES.STATIC,confidence:.99,reason:"단순 인사·감사"};
  if (isEmergencySelfReport(text)) return {route:ROUTES.RISK,confidence:.99,reason:"사용자 긴급 피해 신고",emergency:true};
  const dialogue = inferDialogue(text);
  const route = dialogue.newFacts || (activeTransfer && ["facts","correction"].includes(dialogue.kind))
    ? ROUTES.RISK : dialogue.kind === "action" ? ROUTES.ACTION : ROUTES.GENERAL;
  return {route,confidence:dialogue.confidence,reason:`대화 의도: ${dialogue.kind}`};
}

export function isGreeting(text="") { return GREETING_PATTERN.test(text); }
