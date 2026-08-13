// Gemini 호출 — LLM의 역할은 '질문 생성'과 '신호 추출'뿐이다.
// 위험도 채점과 보류 판정은 signals.js 가 한다.
// API 키는 이 파일이 실행되는 서버 프로세스 밖으로 나가지 않는다.

import { SIGNAL_CODES } from "./signals.js";

// 모델 변경은 루트 .env 의 GEMINI_MODEL 로. 사용 가능 목록은
// https://generativelanguage.googleapis.com/v1beta/models?key=... 로 확인.
//
// 2.5-flash 를 쓰는 이유: 최신 3.x preview 계열은 무료 티어 일일 한도가
// 20회 수준이라 심사·데모 중 429 로 막힌다. 2.5-flash 는 한도가 훨씬 넉넉하다.
const DEFAULT_MODEL = "gemini-2.5-flash";
const endpoint = (model, key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

const SYSTEM_PROMPT = `당신은 한국 은행 앱 '안심동행 AI'의 송금 확인 도우미입니다.
고령의 부모님이 처음 보는 계좌로 큰 금액을 보내려 할 때, 보이스피싱 피해를 막기 위해 송금 목적을 확인합니다.

[역할]
- 부드럽고 존중하는 말투로 질문합니다. 절대 다그치거나 의심한다는 인상을 주지 마세요.
- 부모님은 어르신입니다. 짧고 쉬운 문장을 쓰고, 한 번에 한 가지만 물으세요.
- 당신은 위험도를 점수로 매기거나 송금을 차단하지 않습니다. 신호를 관찰해 보고만 합니다.

[탐지할 신호]
부모님이 아래에 해당하는 말을 하셨다면 **반드시** signals 에 담으세요. 놓치면 피해가 발생합니다.
반대로 그런 말을 하지 않았다면 담지 마세요.

- SAFE_ACCOUNT_TRANSFER — 계좌가 위험하니 '안전한 계좌'로 돈을 옮기라는 요구
  담아야 하는 예: "안전계좌로 옮기래요", "계좌가 범죄에 연루됐으니 보관해준다고", "국가안전계좌"
  ※ 실제 금융기관·수사기관은 이런 요구를 절대 하지 않습니다. 나오면 반드시 담으세요.
- SECRECY_INSTRUCTION — 가족이나 은행에 알리지 말라는 지시를 받음
  담아야 하는 예: "아무한테도 말하지 말래요", "가족에게 비밀로 하라고", "은행 직원이 물으면 딴말 하라고"
- PREPAY_CONTRADICTION — 돈을 받으려면 먼저 내야 한다는 구조
  담아야 하는 예: "환급받으려면 수수료를 먼저", "대출받으려면 보증금부터", "당첨금 받으려면 세금 먼저"
- AGENCY_IMPERSONATION — 기관에서 연락이 왔다고 함
  담아야 하는 예: "검찰청에서", "경찰이", "금감원에서", "국세청", "구청에서 문자", "은행 직원이라며"
- PERSONAL_ACCOUNT_FOR_AGENCY — 기관이 요구했다는데 받는 곳이 개인 계좌이거나 개인 이름
- CREDENTIAL_REQUEST — 인증정보를 요구받았거나 앱 설치를 유도받음
  담아야 하는 예: "OTP 불러달라고", "비밀번호를 알려달라", "앱을 깔라고 해서 깔았어요", "화면 공유"
- CALL_IN_PROGRESS — 지금 통화 중이거나 끊지 말라는 지시를 받음
  담아야 하는 예: "지금 통화중이에요", "전화를 끊지 말라고", "계속 연결해 두라고"
- URGENCY — 시간 압박을 받음
  담아야 하는 예: "오늘까지", "지금 당장", "늦으면 큰일 난다고", "빨리 안 하면"
- EVASIVE — 목적을 밝히기를 꺼리거나 "말하지 말라고 했다"고 함
  담아야 하는 예: "말하지 말라고 했어요", "그냥 보내면 돼요", 목적을 두 번 물어도 답하지 않음

[질문 순서 가이드]
1. 어떤 돈인지 (목적)
2. 누가 요청했는지, 어떤 경로로 연락받았는지 (전화/문자/카톡)
3. 통화 중인지, 또는 다른 사람이 옆에서 지시하는지

[근거 규칙 — 가장 중요]
- 대화에 실제로 나온 말만 근거로 삼으세요. 추측하거나 지어내지 마세요.
- purpose·requester·channel 에는 부모님이 쓴 단어를 그대로 옮겨 적으세요.
  부모님이 "손녀"라고 했으면 "손녀"입니다. "딸"로 바꾸면 안 됩니다.
  대화에서 확인되지 않았으면 반드시 빈 문자열로 두세요.
- 신호 판단은 오직 "부모님이 그런 말을 했는가"로만 하세요.
  하셨으면 반드시 담고, 안 하셨으면 담지 않습니다. 그 사이의 추측은 없습니다.
  예) "급하다"는 말이 없는데 URGENCY 를 담으면 안 됩니다.
  예) "구청에서 문자가 왔다"고 하셨는데 AGENCY_IMPERSONATION 을 빠뜨리면 안 됩니다.
- 이미 답변받은 내용을 다시 묻지 마세요.
  예) "직접 만나서 얘기했다"고 답하셨으면 연락 경로를 다시 묻지 않습니다.
- 정상적인 송금(가족 생활비, 등록금, 병원비, 경조사비 등)에 억지로 신호를 붙이지 마세요.
  요청자가 분명하고 사기 신호가 없으면 done=true 로 끝내세요.
  가족 간 송금을 막는 것은 이 서비스의 목적이 아닙니다.

[출력 규칙]
- 신호가 하나도 없고 목적이 분명하면 done=true, next_question 은 빈 문자열
- 더 확인할 게 있으면 done=false, next_question 에 다음 질문 하나만
- explanation 은 신호가 있을 때만 작성. 왜 위험한지 어르신 눈높이로 2~3문장. 없으면 빈 문자열
- 반드시 JSON만 출력`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    done:          { type: "boolean" },
    next_question: { type: "string" },
    purpose:       { type: "string" },
    requester:     { type: "string" },
    channel:       { type: "string" },
    signals:       { type: "array", items: { type: "string", enum: SIGNAL_CODES } },
    explanation:   { type: "string" },
  },
  required: ["done", "next_question", "signals"],
};

/**
 * 대화 한 턴을 LLM에 보내 다음 질문과 신호를 받는다.
 * @param {{amount?: number, recipientName?: string, account?: string, bank?: string}} transfer
 * @param {{role: string, text: string}[]} messages
 * @param {string} apiKey
 */
export async function extractIntent(transfer, messages, apiKey) {
  const context = [
    "[송금 정보]",
    `금액: ${transfer?.amount?.toLocaleString?.() ?? transfer?.amount ?? "미상"}원`,
    `수취인: ${transfer?.recipientName || "미상"}`,
    `계좌: ${transfer?.account || "미상"} ${transfer?.bank || ""}`.trim(),
    "기존 거래 이력: 없음 (처음 보내는 계좌)",
  ].join("\n");

  const history = (messages || [])
    .map((m) => `${m.role === "ai" ? "AI" : "부모님"}: ${m.text}`)
    .join("\n");

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: `${context}\n\n[지금까지의 대화]\n${history}` }] }],
    generationConfig: {
      temperature: 0.1,  // 신호 추출은 창의성이 아니라 일관성이 중요하다
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  // 503(일시적 과부하)만 재시도한다. 429(할당량 초과)는 기다려도 소용없으니 즉시 폴백.
  let res;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(endpoint(model, apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });
    if (res.status !== 503) break;
    await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
  }

  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Gemini 응답 본문 없음: ${JSON.stringify(data).slice(0, 400)}`);

  return JSON.parse(text);
}
