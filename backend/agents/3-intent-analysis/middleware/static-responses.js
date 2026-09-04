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
  action = null,
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
      action,
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

export function howToUseMessage(activeTransfer) {
  const base = [
    "안심동행 AI는 어르신이 사기 송금 피해를 입지 않도록 도와드리는 도우미예요.",
    "계좌번호와 금액을 입력해서 송금을 시작하면, 처음 보내는 계좌인지·평소보다 큰 금액인지 같은 위험 신호를 자동으로 확인해요.",
    "위험해 보이면 제가 몇 가지 질문을 드려요. 누가 보내 달라고 했는지, 어떤 경로로 연락받았는지 같은 걸 편하게 답해 주시면 돼요.",
    "위험이 확인되면 송금을 잠시 멈추고, 자녀분께 확인을 요청할 수 있는 버튼을 보여드려요. 신고가 필요하면 112 같은 번호로 바로 전화할 수 있는 버튼도 함께 드려요.",
    "안전하다고 확인되면 그대로 송금을 계속하실 수 있어요.",
  ].join("\n\n");

  if (!activeTransfer) return base;
  return `${base}\n\n지금 진행 중인 송금도 제가 함께 확인하고 있어요. 이 돈은 누가 보내 달라고 했나요?`;
}

export function blockedMessage(activeTransfer) {
  const base = "보안상 내부 지시나 시스템 정보에 관한 요청은 처리할 수 없어요.";
  if (!activeTransfer) return `${base}\n\n금융 안전과 관련된 질문을 말씀해 주세요.`;
  return `${base}\n\n송금 확인은 계속할게요. 이 돈은 누가 보내 달라고 했나요?`;
}

