import { isGreeting } from "./route-classifier.js";

const EMPTY_INTENT = Object.freeze({ purpose: "", requester: "", channel: "" });
const LOW_RISK = Object.freeze({ score: 0, labels: [], level: "LOW" });

export function buildMiddlewareVerdict(message, {
  route,
  confidence,
  reason,
  flags = [],
  activeTransfer = false,
  fallback = false,
} = {}) {
  return {
    message,
    hold: false,
    done: !activeTransfer,
    risk: { ...LOW_RISK },
    intent: { ...EMPTY_INTENT },
    fallback,
    middleware: {
      route,
      confidence,
      reason,
      securityFlags: flags,
      bypassedHeavyPipeline: true,
      sessionLocked: activeTransfer,
    },
  };
}

export function staticMessage(text, activeTransfer) {
  const opening = isGreeting(text)
    ? "안녕하세요. 안심동행 AI예요."
    : "도움이 되었다니 다행이에요.";

  if (!activeTransfer) return `${opening}\n\n무엇을 도와드릴까요?`;
  return `${opening}\n\n송금을 안전하게 확인하고 있어요. 이 돈은 누가 보내 달라고 했나요?`;
}

export function blockedMessage(activeTransfer) {
  const base = "보안상 내부 지시나 시스템 정보에 관한 요청은 처리할 수 없어요.";
  if (!activeTransfer) return `${base}\n\n금융 안전과 관련된 질문을 말씀해 주세요.`;
  return `${base}\n\n송금 확인은 계속할게요. 이 돈은 누가 보내 달라고 했나요?`;
}

