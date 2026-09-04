export const ROUTES = Object.freeze({
  STATIC: "STATIC",
  GENERAL: "GENERAL",
  RISK: "RISK",
  BLOCK: "BLOCK",
  ACTION: "ACTION",
});

const GREETING_PATTERN = /^(?:안녕(?:하세요|하십니까)?|반가워요?|좋은\s*(?:아침|오후|저녁)(?:이에요|입니다)?|hi|hello)[!.?\s]*$/i;
const THANKS_PATTERN = /^(?:고마워요?|감사(?:해요|합니다)?|도움이\s*됐어요|thanks?)[!.?\s]*$/i;
const GENERAL_QUESTION_PATTERN = /(?:뭐(?:야|예요|에요)|무엇|뜻|설명해|알려줘|어떻게|차이|왜|방법|기능|사용법|할\s*수\s*있)/i;

// "이 앱 어떻게 써요?" 같은 사용법 질문은 일반 질문(GENERAL_QUESTION_PATTERN)보다
// 먼저 잡아서, 최대 3문장으로 압축되는 짧은 LLM 답변 대신 상세한 고정 안내를 준다.
const HOW_TO_USE_PATTERN = /(?:앱|이거|이건|이\s*서비스|안심동행).{0,10}(?:어떻게|사용법).{0,10}(?:써|쓰|사용|되나요|되는)|사용법.{0,6}(?:알려|뭐|뭔가요|궁금)|(?:안심동행|이 서비스).{0,10}(?:뭐예요|뭐야|무엇)/i;

// "최근 사기수법 알려줘"처럼 자기 상황이 아니라 일반 지식을 묻는 질문은, "사기"라는
// 단어 하나 때문에 STRONG_RISK_PATTERN에 걸려 위험 분석 대화로 끌려가면 안 된다.
// 수법·사례·유형·예방법 같은 학습성 명사와 함께 나올 때만 좁게 잡는다.
const FRAUD_INFO_QUESTION_PATTERN = /(?:사기|보이스피싱|피싱).{0,10}(?:수법|사례|유형|종류|특징|예방법|막는\s*법).{0,10}(?:알려|설명|궁금|뭐|어떤)|(?:최근|요즘|새로운).{0,10}(?:사기|보이스피싱|피싱).{0,10}(?:수법|사례|알려|설명)/i;
const STRONG_RISK_PATTERN = /(?:안전\s*계좌|보이스피싱|사기|검찰|경찰|금감원|국세청|OTP|인증번호|비밀번호|원격\s*제어|앱\s*설치|링크\s*클릭|가족에게\s*비밀|통화\s*중|(?:송금|입금|돈).{0,14}(?:하라|해\s*달|보내|요구|옮기|했다|했어요)|계좌.{0,14}(?:범죄|연루|동결|압류)|수수료를\s*먼저|원금\s*보장)/i;

// 과거형 서술("전화했어요", "신고했었어요")이나 감사 인사("도와줘서 고마워요")를
// 명령으로 오인하지 않도록, 요청형 어미 뒤에 "서"가 오지 않는 경우만 매칭한다.
// middleware/index.js의 buildActionResponse가 같은 패턴을 재사용하도록 export한다 —
// 두 곳에 따로 정의하면 하나만 고쳤을 때 판정과 응답 문구가 어긋난다.
export const FAMILY_PATTERN = /(?:자녀|딸|아들|손자|손녀|가족|아이).{0,6}(?:연결|확인\s*요청|알려\s*줘|알림\s*보내|요청해|전화해|물어봐)(?!서)/i;
export const REPORT_PATTERN = /(?:경찰|112|금감원|1332|은행|고객센터).{0,6}(?:신고|연락|전화|알려|알리)(?:해\s*줘|해\s*주세요|할게요|하고\s*싶|해야|해\s*볼까요|해도\s*될까요)(?!서)/i;
export const HELP_PATTERN = /(?:도와|도움|살려).{0,4}(?:줘|주세요|달라)(?!서)/i;
export const CANCEL_PATTERN = /(?:취소|보내지\s*마|중단|멈춰|막아)|그만(?!\s*(?:두|뒀|둬))/i;

const EMERGENCY_SELF_REPORT_PATTERN = /(?:보이스피싱|사기|피싱).{0,10}(?:당하|걸린|걸렸|인\s*것\s*같|일\s*수|아닌지|인가요|맞나요|같아요|당한|신고)|(?:피해|속[았은]).{0,6}(?:당한|입[었은]|것\s*같|인\s*것|거\s*같)|(?:돈을?\s*(?:잃|날린|빼앗|뺏)|사기\s*맞|사기\s*같|이거\s*사기|사기인가|피싱\s*같)|(?:지금\s*위험|급해요|긴급|도움이\s*필요)/i;

export function hasActiveTransfer(transfer = {}) {
  return Number(transfer.amount) > 0
    || Boolean(String(transfer.account || "").trim())
    || Boolean(String(transfer.recipientName || "").trim());
}

export function classifyRoute({ text = "", activeTransfer = false, injection = {} } = {}) {
  if (injection.blocked) {
    return { route: ROUTES.BLOCK, confidence: 1, reason: "직접적인 프롬프트 인젝션 시도" };
  }
  if (injection.quoted) {
    return { route: ROUTES.RISK, confidence: 0.98, reason: "외부에서 받은 의심 문구를 비신뢰 근거로 분석" };
  }
  if (GREETING_PATTERN.test(text) || THANKS_PATTERN.test(text)) {
    return { route: ROUTES.STATIC, confidence: 0.99, reason: "단순 인사·감사 표현" };
  }
  if (HOW_TO_USE_PATTERN.test(text)) {
    return { route: ROUTES.STATIC, confidence: 0.95, reason: "앱 사용법 질문", howToUse: true };
  }
  if (FRAUD_INFO_QUESTION_PATTERN.test(text)) {
    return { route: ROUTES.GENERAL, confidence: 0.9, reason: "사기 수법에 대한 일반 지식 질문" };
  }
  if (EMERGENCY_SELF_REPORT_PATTERN.test(text)) {
    return { route: ROUTES.RISK, confidence: 0.99, reason: "사용자 긴급 피해 신고", emergency: true };
  }
  const hasStrongRisk = STRONG_RISK_PATTERN.test(text);

  // 자녀 연결·신고·취소처럼 뜻이 명확한 행동 요청은 위험 키워드가 같이 있어도
  // 그대로 즉답한다 — "경찰에 신고해줘"는 위험 분석을 기다릴 필요 없이 바로
  // 도움이 되는 응답이다. 반대로 "도와줘"처럼 막연한 요청은, "검찰"·"안전계좌"
  // 같은 실제 위험 서술이 같이 있으면 캔 답변 대신 제대로 된 위험 분석으로 보낸다.
  // 그렇지 않으면 "검찰이 안전계좌로 옮기라고 해서 무서워요 도와줘" 같은 절박한
  // 신고가 "지금 확인 중이니 기다려 주세요"로 끝나버리는 사고가 난다.
  if (activeTransfer) {
    if (FAMILY_PATTERN.test(text) || REPORT_PATTERN.test(text) || CANCEL_PATTERN.test(text)) {
      return { route: ROUTES.ACTION, confidence: 0.95, reason: "사용자 행동 요청" };
    }
    if (HELP_PATTERN.test(text) && !hasStrongRisk) {
      return { route: ROUTES.ACTION, confidence: 0.95, reason: "사용자 행동 요청" };
    }
  }
  if (hasStrongRisk) {
    return { route: ROUTES.RISK, confidence: 0.97, reason: "송금·사기 위험 관련 표현" };
  }
  if (GENERAL_QUESTION_PATTERN.test(text)) {
    return { route: ROUTES.GENERAL, confidence: 0.86, reason: "일반 설명 질문" };
  }
  if (activeTransfer) {
    return { route: ROUTES.RISK, confidence: 0.9, reason: "진행 중인 송금 확인 세션" };
  }
  return { route: ROUTES.GENERAL, confidence: 0.7, reason: "위험 신호가 없는 일반 대화" };
}

export function isGreeting(text = "") {
  return GREETING_PATTERN.test(text);
}
