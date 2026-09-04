import { generateGeneralResponse } from "./general-llm.js";
import { inspectPromptInjection } from "./injection-guard.js";
import { lastUserText, normalizeRequest } from "./normalize.js";
import {
  CANCEL_PATTERN,
  classifyRoute,
  FAMILY_PATTERN,
  HELP_PATTERN,
  hasActiveTransfer,
  REPORT_PATTERN,
  ROUTES,
} from "./route-classifier.js";
import {
  blockedMessage,
  buildMiddlewareVerdict,
  howToUseMessage,
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

  if (decision.route === ROUTES.ACTION) {
    const { message: actionMessage, action: actionKind } = buildActionResponse(text, conversationState);
    return {
      handled: true,
      response: buildMiddlewareVerdict(actionMessage, {
        ...decision, flags, activeTransfer, action: actionKind,
      }),
    };
  }

  if (decision.route === ROUTES.RISK) {
    return {
      handled: false,
      input: normalized.input,
      middleware: {
        ...decision,
        securityFlags: flags,
        bypassedHeavyPipeline: false,
        sessionLocked: activeTransfer,
        emergency: decision.emergency || false,
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

  // 사용법 질문은 대화가 저장돼 이어지는 중이어도 항상 같은 상세 안내를 준다 —
  // 이전 위험 판정 문맥을 끌어와 섞을 이유가 없는 순수 정보성 질문이다.
  if (decision.route === ROUTES.STATIC && decision.howToUse) {
    return {
      handled: true,
      response: buildMiddlewareVerdict(howToUseMessage(activeTransfer), {
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

function buildActionResponse(text, conversationState = {}) {
  const holdDone = conversationState.analysisHold === true;
  const analysisDone = conversationState.analysisDone === true;

  if (FAMILY_PATTERN.test(text)) {
    if (holdDone) {
      return {
        message: "네, 바로 자녀분께 확인을 요청해 드릴게요. 아래 버튼을 눌러주시면 자녀분이 직접 확인한 뒤에 송금이 진행돼요.",
        action: "family_connect",
      };
    }
    if (analysisDone) {
      return {
        message: "다행히 위험한 점은 발견되지 않았어요. 바로 송금하셔도 괜찮지만, 혹시 걱정되시면 자녀분께 전화로 한번 여쭤보시는 것도 좋아요.",
        action: null,
      };
    }
    return {
      message: "네, 바로 자녀분께 확인을 요청해 드릴게요. 아래 버튼을 눌러주시면 지금 확인하고 계신 내용을 자녀분께 그대로 전달해 드릴게요.",
      action: "family_connect",
    };
  }

  if (REPORT_PATTERN.test(text)) {
    return {
      message: "네, 바로 신고하실 수 있어요. 경찰청은 112, 금감원은 1332, 인터넷진흥원은 118로 전화하시면 돼요. 송금은 제가 잡아두고 있으니 안심하세요.",
      action: null,
    };
  }

  if (HELP_PATTERN.test(text)) {
    if (holdDone) {
      return {
        message: "걱정 마세요, 송금은 지금 멈춰둔 상태예요. 아래 버튼으로 자녀분께 확인을 요청하시거나, 급하시면 경찰청 112로 바로 연락하실 수 있어요.",
        action: "family_connect",
      };
    }
    return {
      message: "걱정 마세요, 제가 도와드릴게요. 지금 이 송금이 안전한지 확인하고 있고, 혹시 위험하면 바로 멈추고 자녀분께 알려드릴게요.",
      action: null,
    };
  }

  if (CANCEL_PATTERN.test(text)) {
    if (holdDone) {
      return {
        message: "네, 이미 송금을 멈춰둔 상태예요. 아래 버튼을 눌러 취소하시거나, 불안하시면 자녀분이나 은행 고객센터에 먼저 확인해 보세요.",
        action: "cancel_transfer",
      };
    }
    return {
      message: "네, 알겠어요. 아래 버튼을 눌러 지금 바로 취소할 수 있어요. 혹시 누군가 보내라고 한 건지, 괜찮으시면 알려주세요.",
      action: "cancel_transfer",
    };
  }

  return { message: "네, 알겠어요. 지금 확인하고 있으니 잠시만 기다려 주세요.", action: null };
}
