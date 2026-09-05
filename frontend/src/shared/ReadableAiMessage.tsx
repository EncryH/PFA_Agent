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

// 신고·상담 안내에 등장하는 공식 번호만 허용한다 — "112만원" 같은 금액 표현을
// 잘못 잡지 않도록, 메시지 전체에 신고·연락·전화·상담 문맥이 있을 때만
// 번호를 추출한다. (숫자 바로 옆이 아니라 목록으로 나열될 때가 많다:
// "경찰청은 112, 금감원은 1332, 118로 전화하시면 돼요")
const REPORT_CONTEXT_PATTERN = /신고|연락|전화|상담/;
const KNOWN_EMERGENCY_NUMBERS: { label: string; number: string; pattern: RegExp }[] = [
  { label: "경찰청", number: "112", pattern: /(?:^|\D)112(?:\D|$)/ },
  { label: "금융감독원", number: "1332", pattern: /(?:^|\D)1332(?:\D|$)/ },
  { label: "인터넷진흥원", number: "118", pattern: /(?:^|\D)118(?:\D|$)/ },
];

export function extractEmergencyNumbers(value: string) {
  const text = String(value || "");
  if (!REPORT_CONTEXT_PATTERN.test(text)) return [];
  return KNOWN_EMERGENCY_NUMBERS.filter((entry) => entry.pattern.test(text));
}

export function formatReadableAiMessage(value: string) {
  // 본문·문장 순서를 보존한다. 화면은 의미를 추정하거나 문구를 생성하지 않는다.
  return String(value || "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
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
        const numbered = trimmed.match(/^(\d+)\.\s*(.+)$/);
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
