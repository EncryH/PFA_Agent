import { FIRST_QUESTION } from "../api/guardian";

const AI_MESSAGE_HEADINGS = new Set([
  "확인한 내용이에요",
  "왜 확인하나요",
  "왜 위험한가요",
  "지금 해야 할 일이에요",
  "한 가지만 확인할게요",
]);

export function isStructuredAiMessage(value: string) {
  const text = String(value || "");
  return [...AI_MESSAGE_HEADINGS].some((heading) => text.includes(heading))
    || /(?:^|\n)[1-4]\.\s/.test(text);
}

export function formatReadableAiMessage(value: string) {
  let text = value
    .replace(/\r\n/g, "\n")
    .replace(/(?:\[|]|[#*_])+\s*(확인한 내용이에요|왜 확인하나요|왜 위험한가요|지금 해야 할 일이에요|한 가지만 확인할게요)\s*(?:\[|]|[#*_])*/g, "$1")
    .replace(/^\s*(?:\[|]|[#*_])+\s*$/gm, "")
    .replace(/([^\n])\s+(?=(?:[1-4])\.\s)/g, "$1\n\n")
    .replace(/\n(?=(?:[2-4])\.\s)/g, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const actionHeading = text.match(/지금 해야 할 일이에요[.!]?/);
  const firstNumber = text.search(/(?:^|\n)1\.\s/);
  if (!text.includes("확인한 내용이에요") && (actionHeading || firstNumber >= 0)) {
    const splitIndex = actionHeading?.index ?? firstNumber;
    const summary = text.slice(0, splitIndex).trim();
    const actions = text
      .slice(actionHeading ? splitIndex + actionHeading[0].length : splitIndex)
      .trim();
    const sentences = summary
      .replace(/\n+/g, " ")
      .match(/[^.!?]+(?:[.!?]+|$)/g)
      ?.map((sentence) => sentence.trim())
      .filter(Boolean) || [];
    text = [
      "확인한 내용이에요",
      sentences.slice(0, 1).join(" "),
      "왜 위험한가요",
      sentences.slice(1, 3).join(" ") || "말씀하신 요구는 금융사기 수법과 비슷해요.",
      "지금 해야 할 일이에요",
      actions,
    ].filter(Boolean).join("\n\n");
  }

  // 이미 구조화된 헤더가 있는 메시지만 포맷팅한다.
  // 헤더가 없는 자연스러운 대화 응답은 강제 구조화하지 않는다.

  return text;
}

export function formatAiSpeechText(value: string, structured = true) {
  return (structured ? formatReadableAiMessage(value) : value)
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\uFE0F|\u200D|\u20E3/g, "")
    .replace(/[ \t]+([,.!?？])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function ReadableAiMessage({ text }: { text: string }) {
  return (
    <div>
      {formatReadableAiMessage(text).split("\n").map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={index} className="h-2" aria-hidden="true" />;
        if (AI_MESSAGE_HEADINGS.has(trimmed.replace(/[.!]$/, ""))) {
          return <p key={index} className={`${index > 0 ? "mt-1" : ""} font-extrabold text-[var(--ac-700)]`}>{trimmed.replace(/[.!]$/, "")}</p>;
        }
        const numbered = trimmed.match(/^([1-4])\.\s*(.+)$/);
        if (numbered) {
          return (
            <div key={index} className="flex items-start gap-2">
              <span className="mt-[2px] font-extrabold text-[var(--ac-600)]">{numbered[1]}.</span>
              <span className="min-w-0 flex-1">{numbered[2]}</span>
            </div>
          );
        }
        return <p key={index}>{trimmed}</p>;
      })}
    </div>
  );
}
