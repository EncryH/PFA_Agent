// 상담용 상태이며 금융기관의 실제 처리 완료를 증명하지 않는다.
export const FACT_KEYS = ["transfer", "link", "app", "personal", "credential", "bank_contact", "freeze_request", "police_report"];
const SUBJECTS = {
  transfer: /돈|송금|입금|이체|대금|수수료/,
  link: /링크|주소|URL/i, app: /앱|어플|원격제어/,
  personal: /개인정보|신분증|주민번호|카드번호|계좌\s*정보/,
  credential: /인증번호|OTP|비밀번호/i,
  bank_contact: /은행|금융회사|고객센터/, freeze_request: /지급정지/, police_report: /경찰|112/,
};
const COMPLETED = {
  transfer: /보냈|보내버렸|송금했|입금했|이체했|완료했|해버렸|빠져나갔|(?:송금|입금|이체)(?:을|를)?\s*했/,
  link: /눌렀|클릭했|접속했/, app: /설치했|깔았/,
  personal: /알려줬|알려주었|제공했|입력했|보냈|넘겼/,
  credential: /알려줬|알려주었|제공했|입력했|보냈|넘겼/,
  bank_contact: /연락했|전화했|통화했|연락드렸/,
  freeze_request: /요청했|신청했|접수했|처리됐|완료됐|됐어요/,
  police_report: /신고했|접수했|신고를 했/,
};
const NEGATIVE = /안\s*(?:보냈|했|눌렀|깔았|설치|알려|제공|입력|송금|이체|입금)|못\s*(?:보냈|했|알려|눌렀)|(?:하지|보내지|알려주지|누르지|설치하지)\s*않|적(?:은|이)?\s*없/;
const HYPOTHETICAL = /(?:보냈|했|눌렀|알려줬|설치했)(?:으면|다면)|(?:보내|하|누르|알려주)면|만약|가정|예를\s*들/;
const REPORTED = /(?:사기|피싱).{0,10}(?:당했|당한|피해)|피해.{0,5}(?:봤|입었)|속았|돈.{0,4}(?:빼앗|뺏겼|빠져나갔)/;

export function normalizeSituation(value = {}) {
  const facts = {};
  for (const key of FACT_KEYS) {
    const fact = value?.facts?.[key];
    if (fact && ["yes", "no"].includes(fact.status) && typeof fact.evidence === "string") {
      facts[key] = { status: fact.status, evidence: fact.evidence.slice(0, 160) };
    }
  }
  return { facts, reportedDamage: value?.reportedDamage === true };
}

export function resolveSituation(messages = [], previous = {}, extractedFacts = []) {
  const state = normalizeSituation(previous);
  let previousQuestion = "";
  const pending = Object.keys(state.facts).length || state.reportedDamage ? messages.slice(-2) : messages;
  for (const message of pending) {
    const text = String(message.text || "").trim();
    if (message.role === "ai") { previousQuestion = text; continue; }
    for (const clause of text.split(/지만|는데|[.!?。\n]|(?:그리고|하지만|그런데)/).filter(Boolean)) {
      if (HYPOTHETICAL.test(clause)) continue;
      if (REPORTED.test(clause)) state.reportedDamage = true;
      for (const key of FACT_KEYS) {
        if (!SUBJECTS[key].test(clause)) continue;
        if (NEGATIVE.test(clause)) state.facts[key] = { status: "no", evidence: clause.trim().slice(0, 160) };
        else if (COMPLETED[key].test(clause)) state.facts[key] = { status: "yes", evidence: clause.trim().slice(0, 160) };
      }
    }
    const question = previousQuestion.match(/[^.!?\n]*[?？]/g)?.at(-1) || "";
    const keys = FACT_KEYS.filter((key) => SUBJECTS[key].test(question));
    if (keys.length === 1 && /이미|하셨|보내셨|보냈|했나요|눌렀|알려주셨/.test(question)
      && /^(?:네|예|응|아니요|아직이요|보냈어요|했어요|안\s*보냈어요|아직\s*안\s*했어요)[.!\s]*$/.test(text)) {
      state.facts[keys[0]] = { status: /아니|아직|안\s/.test(text) ? "no" : "yes", evidence: text };
    }
  }
  const latest = [...messages].reverse().find((m) => m.role !== "ai")?.text || "";
  for (const fact of Array.isArray(extractedFacts) ? extractedFacts : []) {
    if (!FACT_KEYS.includes(fact.key) || !["yes", "no"].includes(fact.status)) continue;
    if (!fact.evidence?.trim() || !latest.includes(fact.evidence) || HYPOTHETICAL.test(latest)) continue;
    if (fact.status === "yes" && NEGATIVE.test(fact.evidence)) continue;
    state.facts[fact.key] = { status: fact.status, evidence: fact.evidence.slice(0, 160) };
  }
  return state;
}

export function needsDamageResponse(state = {}) {
  return state.reportedDamage === true || ["transfer", "link", "app", "personal", "credential"].some((key) => state.facts?.[key]?.status === "yes");
}
export function isHypothetical(text = "") { return HYPOTHETICAL.test(text); }
