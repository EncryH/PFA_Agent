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

  if (decision.route === ROUTES.ACTION) {
    const actionMessage = buildActionResponse(text, conversationState);
    return {
      handled: true,
      response: buildMiddlewareVerdict(actionMessage, {
        ...decision, flags, activeTransfer,
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

const FAMILY_PATTERN = /(?:자녀|딸|아들|손자|손녀|가족|아이|애).{0,6}(?:연결|확인|알려|알림|보내|요청|전화|물어)/i;
const REPORT_PATTERN = /(?:경찰|112|금감원|1332|은행|고객센터).{0,6}(?:신고|연락|전화|알려|알리)/i;
const HELP_PATTERN = /(?:도와|도움|살려).{0,4}(?:줘|주세요|달라)/i;
const CANCEL_PATTERN = /(?:취소|그만|보내지\s*마|중단|멈춰|막아)/i;

function buildActionResponse(text, conversationState = {}) {
  const holdDone = conversationState.analysisHold === true;
  const analysisDone = conversationState.analysisDone === true;

  if (FAMILY_PATTERN.test(text)) {
    if (holdDone) {
      return "네, 자녀에게 확인을 요청할 수 있어요.\n\n아래 '자녀에게 확인 요청하기' 버튼을 눌러주세요.\n\n자녀분이 직접 확인해 주셔야 송금이 진행돼요.";
    }
    if (analysisDone) {
      return "확인 결과 위험 신호가 없어서 자녀 확인 없이도 송금할 수 있어요.\n\n그래도 걱정되시면 자녀분에게 직접 전화해서 여쭤보세요.";
    }
    return "지금 송금 안전성을 확인하고 있어요.\n\n확인이 끝나면 자녀에게 알림을 보낼 수 있어요.\n\n먼저 몇 가지만 더 확인할게요.";
  }

  if (REPORT_PATTERN.test(text)) {
    return "신고가 필요하시면 아래 번호로 연락하세요.\n\n1. 경찰청 112 — 금융사기 신고\n2. 금감원 1332 — 금융피해 상담\n3. 한국인터넷진흥원 118 — 피싱·해킹 상담\n\n지금 송금은 보류하고 있으니 안심하세요.";
  }

  if (HELP_PATTERN.test(text)) {
    if (holdDone) {
      return "걱정하지 마세요. 송금은 지금 보류 중이에요.\n\n자녀에게 확인을 요청하거나, 경찰청 112로 신고할 수 있어요.\n\n아래 버튼을 눌러 자녀에게 확인을 요청해 보세요.";
    }
    return "걱정하지 마세요. 제가 도와드릴게요.\n\n지금 송금 안전성을 확인하고 있어요.\n\n위험하면 송금을 멈추고 자녀에게 알려드릴게요.";
  }

  if (CANCEL_PATTERN.test(text)) {
    return "네, 송금을 보류하고 있어요.\n\n이 화면을 나가시면 송금이 취소돼요.\n\n불안하시면 자녀나 은행 고객센터에 먼저 확인해 보세요.";
  }

  return "네, 알겠어요.\n\n지금 송금 안전성을 확인하고 있으니 잠시만 기다려 주세요.";
}
