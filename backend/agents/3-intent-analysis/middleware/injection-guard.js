const DIRECT_INJECTION_PATTERNS = [
  /(?:이전|앞의|위의|기존).{0,24}(?:지시|명령|규칙|프롬프트).{0,24}(?:무시|잊어|삭제|취소)/i,
  /(?:ignore|forget|discard).{0,24}(?:previous|prior|above|system).{0,24}(?:instruction|prompt|message)/i,
  /(?:시스템|개발자|system|developer).{0,18}(?:프롬프트|메시지|prompt).{0,18}(?:출력|공개|보여|말해|reveal|print|show)/i,
  // "GEMINI_API_KEY"처럼 언더스코어로 이어진 변수명도 잡아야 하므로 \s* 대신 [\s_]* 를 쓴다.
  /(?:[a-z_]*api[\s_]*key|비밀키|환경[\s_]*변수|access[\s_]*token).{0,24}(?:출력|공개|보여|알려|뭐야|뭐예요|reveal|print|show)/i,
  /<(?:system|developer|assistant|tool)>/i,
  /(?:역할|role).{0,18}(?:바꿔|변경|재정의|override|change).{0,18}(?:제한|규칙|지시|instruction)?/i,
];

const QUOTED_CONTEXT = /(?:(?:받은|온|도착한).{0,12}(?:문자|메시지|카톡|채팅)|(?:문자|메시지|카톡|채팅).{0,24}(?:내용|문구|적혀|써\s*있|라고\s*(?:했|왔|적)))/i;

export function inspectPromptInjection(text = "") {
  const matched = DIRECT_INJECTION_PATTERNS.some((pattern) => pattern.test(text));
  if (!matched) return { blocked: false, quoted: false, flags: [] };

  const quoted = QUOTED_CONTEXT.test(text);
  return {
    blocked: !quoted,
    quoted,
    flags: [quoted ? "QUOTED_INJECTION_LIKE_TEXT" : "PROMPT_INJECTION_ATTEMPT"],
  };
}
