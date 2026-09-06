// 문구를 치환하지 않고 오류 사유를 반환해 전체 답변을 다시 생성한다.
export function validateContactAdvice(text = "") {
  if (/(?:경찰|신고|피해|지급정지)[\s\S]{0,30}(?<!\d)182(?!\d)|(?<!\d)182(?!\d)[\s\S]{0,30}(?:경찰|신고|피해|지급정지)/.test(text)) {
    throw new Error("보이스피싱 긴급 피해 신고는 경찰 112입니다. 182를 긴급 신고 번호로 안내하지 마세요.");
  }
}

// 실제 실행 권한은 없으며, 설명 경로는 송금의 안전 판정도 새로 내리지 않는다.
export function validateDialogueResponse(text = "", context = {}) {
  if (/(?:신고|지급정지|알림|확인 요청|취소)(?:를|가|은|는)?\s*(?:완료했|처리했|보냈|접수했)(?:어요|습니다)|(?:제가|AI가).{0,18}(?:잡아두|멈춰|막아|알려드릴|연결해\s*드릴)/.test(text)) {
    throw new Error("AI가 실제 기관 접수·알림·송금 제어를 실행하거나 약속하지 마세요. 사용자가 할 수 있는 행동만 안내하세요.");
  }
  if (/(?:상대방|그\s*사람)(?:은|이)\s*사기꾼|(?:그|이)\s*계좌는\s*사기꾼|거짓말이니|확실한 사기|100%\s*사기/.test(text)) {
    throw new Error("설명을 쉽게 하더라도 의심을 확정으로 바꾸지 마세요. 수취인을 범죄자로 단정하지 마세요.");
  }
  const namedTerms = new Set(["google","naver","youtube","http","https","android","iphone","safe","browsing"]);
  const prose = text.replace(/https?:\/\/\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi, "");
  for (const word of prose.match(/\b[a-z]{4,}\b/g) || []) {
    if (!namedTerms.has(word) && !String(context.userText || "").includes(word)) {
      throw new Error("한국어 설명 중 불필요한 영어 단어가 섞였습니다. 사용자에게 필요한 한국어로 다시 작성하세요.");
    }
  }
  if (/바로 송금하셔도|안전하니|안전하다고 확인|안심하(?:세요|셔도)|걱정\s*마세요/.test(text)) {
    throw new Error("안전을 보장하거나 송금을 허가하지 말고 확인된 상황에 맞게 답하세요.");
  }
  if (context.situation?.facts?.transfer?.status === "yes" && /지금은 송금하지|송금하기 전|보내려(?:고| 해)/.test(text)) {
    throw new Error("이미 송금한 피해 상황을 송금 전으로 표현하지 마세요.");
  }
  if (!context.allowedAction && /아래 버튼|하단 버튼/.test(text)) {
    throw new Error("이번 답변에 제공되지 않은 버튼을 안내하지 마세요.");
  }
  if (context.presentation === "structured_actions") {
    if (!text.trim().startsWith("지금 해야 할 일이에요") || !/(?:^|\n)1\.\s/.test(text)) {
      throw new Error("완료 후 다음 행동 답변은 '지금 해야 할 일이에요'와 번호 목록으로 작성하세요.");
    }
  }
  const appConfirmed = context.situation?.facts?.app?.status === "yes";
  if (context.analysisDone && context.analysisHold && !appConfirmed
    && /악성\s*앱.{0,24}(?:설치되었|설치됐|깔려|감염되었|감염됐|있을\s*수)/.test(text)) {
    throw new Error("확인되지 않은 악성 앱 설치·감염 상태를 추측하지 마세요.");
  }
}
export const CONTACT_GUIDANCE = "보이스피싱 긴급 피해 신고·지급정지 요청은 경찰 112 또는 관련 금융회사 공식 고객센터로 안내하세요. 1332는 금융감독원 상담, 118은 인터넷 침해 상담입니다. 182를 긴급 피해 신고 번호로 안내하지 마세요. 확인되지 않은 금융회사 전화번호를 만들지 마세요.";
