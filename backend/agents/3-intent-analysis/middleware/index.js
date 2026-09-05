import { generateGeneralResponse } from "./general-llm.js";
import { resolveSituation, needsDamageResponse } from "../../../../shared/conversation-state.js";
import { inspectPromptInjection } from "./injection-guard.js";
import { lastUserText, normalizeRequest } from "./normalize.js";
import { classifyRoute, hasActiveTransfer, ROUTES } from "./route-classifier.js";
import { blockedMessage, buildMiddlewareVerdict, staticMessage } from "./static-responses.js";
import { analysisTurn, classifyDialogue, dialoguePlan } from "./dialogue.js";
import { damageResponsePlan } from "../response-plan.js";

export async function routeIntentRequest(input = {}, {
  apiKey = "", generalChat = generateGeneralResponse, dialogueClassifier = classifyDialogue,
} = {}) {
  const normalized = normalizeRequest(input);
  const body = normalized.input;
  const text = lastUserText(body.messages);
  const activeTransfer = hasActiveTransfer(body.transfer);
  const state = body.conversationState;
  const injection = inspectPromptInjection(text);
  const flags = [...normalized.flags, ...injection.flags];
  const base = classifyRoute({text,activeTransfer,injection});
  const handled = (message, decision, extra = {}) => ({handled:true,response:buildMiddlewareVerdict(message,{
    ...decision,flags,activeTransfer,...extra,
  })});
  if (normalized.flags.length) return handled("입력 내용이 너무 길어요. 필요한 내용만 짧게 다시 말씀해 주세요.", {route:ROUTES.BLOCK,reason:"입력 허용 범위 초과",confidence:1});
  if (injection.blocked) return handled(blockedMessage(activeTransfer),base);
  const situation = resolveSituation(body.messages,state.situation);
  state.situation = situation;
  const damage = needsDamageResponse(situation);
  const fullAnalysis = (dialogue, reason) => ({
    handled:false,
    input:{...body,turn:analysisTurn(body),dialogue},
    middleware:{route:ROUTES.RISK,reason,confidence:1,securityFlags:flags,bypassedHeavyPipeline:false,
      sessionLocked:activeTransfer,emergency:damage,dialogueKind:dialogue.kind},
  });
  if (injection.quoted) return fullAnalysis({kind:"facts",newFacts:true},base.reason);
  if (base.route === ROUTES.STATIC && !base.howToUse && body.messages.length === 1 && !damage) {
    return handled(staticMessage(text,activeTransfer),base);
  }

  const dialogue = await dialogueClassifier(body.messages,apiKey);
  // 실행 여부가 아닌 대화 목적만 분류한다. 새 사실은 기존 안전 분석을 거친다.
  if (dialogue.newFacts || (damage && ["help","facts","correction"].includes(dialogue.kind))
    || (activeTransfer && ["facts","correction"].includes(dialogue.kind))) {
    return fullAnalysis(dialogue,damage ? "피해 상황의 새 사실·도움 요청" : "새로운 송금 상황 분석");
  }

  const requested = dialogue.action;
  const action = damage ? "damage_response"
    : activeTransfer && ["family_connect","cancel_transfer"].includes(requested) ? requested : null;
  const route = dialogue.kind === "action" ? ROUTES.ACTION : ROUTES.GENERAL;
  const responsePlan = {
    ...dialoguePlan(dialogue),situation,
    ...(damage ? {damageActions:damageResponsePlan(situation,text).actions} : {}),
    allowedAction:action,requestedAction:requested,
    capabilities:"현재 화면은 송금 의도 상담입니다. 가족 확인은 제공된 버튼에서 사용자가 요청하며, 해당 위험 거래 확인에 필요한 최소정보만 공유합니다. 부모의 전체 거래내역과 잔액을 공유하지 않습니다. 가족은 송금을 직접 실행하지 않습니다. 신고·지급정지는 관계기관에서 처리합니다. AI는 직접 전화하거나 송금을 실행·취소하거나 기관 접수를 완료하지 않습니다. 가족 연결 여부와 보호 수준이 제공되지 않았다면 자동 알림·차단을 약속하지 마세요.",
  };
  const general = await generalChat(text,apiKey,{messages:body.messages,conversationState:state,responsePlan});
  const result = handled(general.message,{route,confidence:dialogue.confidence,reason:`대화 의도: ${dialogue.kind}`}, {
    fallback:general.fallback,action,
  });
  // 설명 응답은 위험 판정/진행 상태를 새로 결정하지 않는다.
  result.response.hold = state.analysisHold;
  result.response.done = activeTransfer ? false : state.analysisDone;
  result.response.middleware.dialogueKind = dialogue.kind;
  result.response.middleware.dialogueSource = dialogue.source;
  return result;
}
