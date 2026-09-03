import { generateGeneralResponse } from "./general-llm.js";
import { inspectPromptInjection } from "./injection-guard.js";
import { lastUserText, normalizeRequest } from "./normalize.js";
import { classifyRoute, hasActiveTransfer, ROUTES } from "./route-classifier.js";
import {
  blockedMessage,
  buildMiddlewareVerdict,
  staticMessage,
} from "./static-responses.js";

export async function routeIntentRequest(input = {}, {
  apiKey = "",
  generalChat = generateGeneralResponse,
} = {}) {
  const normalized = normalizeRequest(input);
  const text = lastUserText(normalized.input.messages);
  const activeTransfer = hasActiveTransfer(normalized.input.transfer);
  const conversationState = normalized.input.conversationState || {};
  const isResumedConversation = conversationState.resumed === true
    && normalized.input.messages.slice(0, -1).some((message) => message.text);
  const injection = inspectPromptInjection(text);

  if (normalized.flags.length) {
    const decision = {
      route: ROUTES.BLOCK,
      confidence: 1,
      reason: "입력 허용 범위 초과",
    };
    return {
      handled: true,
      response: buildMiddlewareVerdict(
        "입력 내용이 너무 길어요. 필요한 내용만 짧게 다시 말씀해 주세요.",
        { ...decision, flags: normalized.flags, activeTransfer },
      ),
    };
  }

  const decision = classifyRoute({ text, activeTransfer, injection });
  const flags = [...normalized.flags, ...injection.flags];

  if (decision.route === ROUTES.RISK) {
    return {
      handled: false,
      input: normalized.input,
      middleware: {
        ...decision,
        securityFlags: flags,
        bypassedHeavyPipeline: false,
        sessionLocked: activeTransfer,
      },
    };
  }

  if (decision.route === ROUTES.BLOCK) {
    return {
      handled: true,
      response: buildMiddlewareVerdict(blockedMessage(activeTransfer), {
        ...decision, flags, activeTransfer,
      }),
    };
  }

  // 저장 상담의 인사는 새 상담용 고정 문구로 돌리지 않는다. 이전 대화를 함께 읽는
  // 경량 LLM이 당시 확인하던 내용을 짚고 자연스럽게 상담을 이어간다.
  if (decision.route === ROUTES.STATIC && isResumedConversation) {
    const continuationDecision = {
      route: ROUTES.GENERAL,
      confidence: decision.confidence,
      reason: "저장된 상담의 문맥을 이어가는 인사",
    };
    const general = await generalChat(text, apiKey, {
      messages: normalized.input.messages,
      conversationState,
    });
    return {
      handled: true,
      response: buildMiddlewareVerdict(general.message, {
        ...continuationDecision,
        flags,
        activeTransfer,
        fallback: general.fallback,
      }),
    };
  }

  if (decision.route === ROUTES.STATIC) {
    return {
      handled: true,
      response: buildMiddlewareVerdict(staticMessage(text, activeTransfer), {
        ...decision, flags, activeTransfer,
      }),
    };
  }

  const general = await generalChat(text, apiKey, isResumedConversation ? {
    messages: normalized.input.messages,
    conversationState,
  } : undefined);
  const reminder = activeTransfer && !isResumedConversation
    ? "\n\n지금 진행 중인 송금도 안전하게 확인할게요. 누구의 요청으로 보내시는 돈인지 알려주세요."
    : "";
  return {
    handled: true,
    response: buildMiddlewareVerdict(`${general.message}${reminder}`, {
      ...decision,
      flags,
      activeTransfer,
      fallback: general.fallback,
    }),
  };
}
