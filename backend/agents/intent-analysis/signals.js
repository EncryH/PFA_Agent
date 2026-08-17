// 4층 위험 채점 규칙
//
// 설계 원칙: "Rules decide, AI explains"
//   - LLM은 대화에서 신호를 '추출'만 한다 (아래 코드 중에서 고르기)
//   - 점수 계산과 보류 판정은 오직 이 파일이 한다
//   - 서버에서만 실행된다 — 클라이언트가 점수를 조작할 수 없다

export const SIGNALS = {
  // 단독으로도 사기가 확실한 신호 — 정상 거래에서는 나타날 수 없다
  SAFE_ACCOUNT_TRANSFER:       { score: 50, label: "안전계좌로 옮기라는 요구" },
  SECRECY_INSTRUCTION:         { score: 40, label: "가족에게 말하지 말라는 요구" },

  PREPAY_CONTRADICTION:        { score: 30, label: "돈을 받기 전 선입금 요구" },
  CREDENTIAL_REQUEST:          { score: 30, label: "비밀번호·인증번호 요구" },
  APP_INSTALLATION_REQUEST:    { score: 30, label: "낯선 앱 설치 요구" },
  MALICIOUS_URL:               { score: 25, label: "낯선 링크 클릭 요구" },
  PERSONAL_DATA_REQUEST:       { score: 25, label: "신분증·개인정보 요구" },
  CALL_IN_PROGRESS:            { score: 30, label: "통화하면서 송금 요구" },
  AGENCY_IMPERSONATION:        { score: 25, label: "은행·기관을 사칭한 연락" },
  PERSONAL_ACCOUNT_FOR_AGENCY: { score: 25, label: "기관이 개인 계좌로 송금 요구" },
  ANSWER_CONTRADICTION:         { score: 25, label: "송금 이유가 앞뒤와 다름" },
  GUARANTEED_RETURN:            { score: 30, label: "수익이나 원금 보장 약속" },
  ADDITIONAL_PAYMENT_REQUEST:   { score: 30, label: "출금 전 추가 입금 요구" },
  CHANGED_FAMILY_CONTACT:       { score: 25, label: "가족이 새 번호로 송금 요구" },
  EVASIVE:                     { score: 20, label: "송금 이유 확인을 피함" },
  URGENCY:                     { score: 15, label: "지금 보내라고 재촉" },
  SMS_LURE:                    { score: 10, label: "의심 문자로 연락" },
};

export const SIGNAL_CODES = Object.keys(SIGNALS);

export const HOLD_THRESHOLD = 50;  // 이상이면 5층 가족 확인으로
export const MAX_TURNS = 4;        // 질문 상한 — 부모님을 지치게 하지 않는다

/** 추출된 신호 코드 배열 → 점수·등급·라벨 */
export function scoreSignals(codes = [], { patternRiskScore = 0 } = {}) {
  const valid = [...new Set(codes)].filter((c) => c in SIGNALS);
  const baseScore = Math.max(0, Math.min(Number(patternRiskScore) || 0, 40));
  const signalScore = valid.reduce((sum, c) => sum + SIGNALS[c].score, 0);
  // 거래 패턴 점수는 의도 대화를 실행하는 트리거다. 대화에서 위험 신호가
  // 하나도 확인되지 않았다면 고액·신규 계좌라는 이유만으로 사기로 판정하지 않는다.
  const score = signalScore === 0 ? 0 : Math.min(baseScore + signalScore, 100);
  return {
    score,
    codes: valid,
    components: { pattern: baseScore, intent: signalScore },
    labels: valid.map((c) => SIGNALS[c].label),
    level: score >= HOLD_THRESHOLD ? "HIGH" : score >= 30 ? "MEDIUM" : "LOW",
  };
}

/** Gemini가 잠시 unavailable이어도 명시적인 위험 표현은 놓치지 않는다. */
export function extractRuleSignals(messages = [], transfer = {}) {
  const text = messages
    .filter((message) => message.role !== "ai")
    .map((message) => String(message.text || ""))
    .join(" ");
  const detected = [];
  const add = (code, pattern) => {
    if (pattern.test(text)) detected.push(code);
  };

  add("SAFE_ACCOUNT_TRANSFER", /안전\s*계좌|보호\s*계좌|국가\s*안전\s*계좌|계좌.{0,12}(보호|보관).{0,10}(옮기|이체)/);
  add("SECRECY_INSTRUCTION", /가족.{0,8}(말하지|비밀)|아무한테도.{0,8}(말하지|알리지)|은행.{0,8}(딴말|말하지)/);
  add("PREPAY_CONTRADICTION", /(대출|환급|당첨|지원금|보상).{0,24}(보증금|수수료|세금|예치금).{0,24}(먼저|선입금|보내|입금)|(?:보증금|수수료|세금|예치금).{0,18}(먼저|선입금).{0,24}(대출|환급|당첨|지원금|보상)/);
  add("CREDENTIAL_REQUEST", /OTP|인증\s*번호|비밀\s*번호|보안\s*카드.{0,8}(알려|불러|보내)/i);
  add("APP_INSTALLATION_REQUEST", /(앱|어플|프로그램).{0,10}(설치|깔)|원격\s*제어|화면\s*공유/);
  add("MALICIOUS_URL", /(낯선|모르는|보내준|문자).{0,12}(링크|URL|주소).{0,8}(누르|클릭|접속)|(?:링크|URL).{0,8}(누르|클릭|접속)/i);
  add("PERSONAL_DATA_REQUEST", /주민\s*번호|신분증|계좌\s*정보|개인\s*정보.{0,10}(보내|알려|사진)/);
  add("CALL_IN_PROGRESS", /지금.{0,8}통화\s*중|통화.{0,8}(중|하면서|끊지)|전화.{0,8}끊지/);
  add("AGENCY_IMPERSONATION", /검찰|경찰|금감원|금융감독원|국세청|구청|정부기관|은행\s*(상담사|직원|보안팀)/);
  add("URGENCY", /오늘\s*안|지금\s*(당장|바로)|늦으면|빨리.{0,8}(보내|입금|이체)|시간이\s*없/);
  add("SMS_LURE", /문자.{0,16}(연락|링크|전화|송금|입금)|문자로.{0,12}(왔|보내|알려)/);
  add("GUARANTEED_RETURN", /원금\s*보장|수익\s*보장|무조건\s*수익|손실.{0,8}(없|안\s*나)/);
  add("ADDITIONAL_PAYMENT_REQUEST", /(출금|환급|복구|돌려받).{0,16}(추가|한\s*번\s*더|수수료를\s*더|돈을\s*더|더\s*(보내|입금))|미션.{0,12}(끝내|완료).{0,12}(돌려|출금)/);
  add("CHANGED_FAMILY_CONTACT", /(아들|딸|손자|손녀|가족|지인).{0,18}(새\s*번호|휴대폰.{0,5}고장|새\s*카톡|번호.{0,5}바뀌)/);

  if (transfer.call_in_progress) detected.push("CALL_IN_PROGRESS");
  const hasAgency = detected.includes("AGENCY_IMPERSONATION");
  if (hasAgency && transfer.recipient_display_type === "personal_name") {
    detected.push("PERSONAL_ACCOUNT_FOR_AGENCY");
  }
  return [...new Set(detected)];
}

const PURPOSE_GROUPS = Object.freeze([
  { key: "hospital", label: "병원비·치료비", pattern: /병원비|치료비|수술비|약값/ },
  { key: "loan", label: "대출 관련 비용", pattern: /대출|심사비|대출\s*보증금/ },
  { key: "investment", label: "투자금", pattern: /투자|주식|코인|가상.?자산|리딩방/ },
  { key: "refund", label: "환급·지원금", pattern: /환급|당첨금|지원금|보상금/ },
  { key: "housing", label: "주거 계약금", pattern: /전세|월세|잔금|계약금/ },
  { key: "education", label: "등록금·학비", pattern: /등록금|학비|교육비/ },
  { key: "living", label: "생활비·용돈", pattern: /생활비|용돈/ },
  { key: "purchase", label: "물건 구매금", pattern: /물건|구매|중고.?거래/ },
  { key: "event", label: "경조사비", pattern: /축의금|부의금|경조사/ },
]);

/** 서로 다른 사용자 답변에서 송금 목적이 명확히 바뀐 경우만 잡는다. */
export function extractRuleContradictions(messages = []) {
  const purposes = messages
    .filter((message) => message.role !== "ai")
    .map((message) => {
      const text = String(message.text || "");
      const group = PURPOSE_GROUPS.find((item) => item.pattern.test(text));
      return group ? { ...group, text } : null;
    })
    .filter(Boolean);
  const first = purposes[0];
  const changed = purposes.find((item) => item.key !== first?.key);
  if (!first || !changed) return [];
  return [`처음 답변: ${first.label}\n이후 답변: ${changed.label}`];
}
