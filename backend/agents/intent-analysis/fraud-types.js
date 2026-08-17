export const FRAUD_TYPES = Object.freeze({
  institution_impersonation: "은행·기관을 사칭한 사기",
  loan_advance_fee: "대출 전에 돈을 요구하는 사기",
  refund_advance_fee: "환급·당첨금 전에 돈을 요구하는 사기",
  family_or_acquaintance_impersonation: "가족·지인을 사칭한 사기",
  smishing: "문자·악성 링크 사기",
  malicious_app: "악성 앱·원격제어 사기",
  personal_information_phishing: "개인정보를 노린 사기",
  investment_fraud: "투자 사기",
  job_or_mission_fraud: "부업·미션형 사기",
  other: "기타 금융사기 의심",
  none: "사기 의심 없음",
  unknown: "유형 확인 필요",
});

export const FRAUD_TYPE_CODES = Object.keys(FRAUD_TYPES);

export function classifyFraudType({ llm = {}, signals = [], messages = [] } = {}) {
  if (!signals.length) return result("none", "rules");

  const text = [
    llm.purpose,
    llm.requester,
    llm.channel,
    ...messages.map((message) => message.text),
  ].filter(Boolean).join(" ");
  const has = (code) => signals.includes(code);

  if (has("PREPAY_CONTRADICTION") && /대출|저금리|보증금|심사비/.test(text)) {
    return result("loan_advance_fee", "rules");
  }
  if (has("PREPAY_CONTRADICTION") && /환급|당첨|세금|지원금/.test(text)) {
    return result("refund_advance_fee", "rules");
  }
  if (has("CHANGED_FAMILY_CONTACT") || ((has("SECRECY_INSTRUCTION") || has("URGENCY")) && /아들|딸|손자|손녀|가족|지인/.test(text))) {
    return result("family_or_acquaintance_impersonation", "rules");
  }
  if (has("GUARANTEED_RETURN") && /투자|수익|주식|코인|가상.?자산|리딩/.test(text)) {
    return result("investment_fraud", "rules");
  }
  if (has("ADDITIONAL_PAYMENT_REQUEST") && /부업|미션|과제|쇼핑몰|구매.?대행|팀.?미션/.test(text)) {
    return result("job_or_mission_fraud", "rules");
  }
  if (has("ADDITIONAL_PAYMENT_REQUEST") && /환급|당첨|출금|돌려받/.test(text)) {
    return result("refund_advance_fee", "rules");
  }
  if (has("SAFE_ACCOUNT_TRANSFER") || has("AGENCY_IMPERSONATION") || has("PERSONAL_ACCOUNT_FOR_AGENCY")) {
    return result("institution_impersonation", "rules");
  }
  if ((has("CREDENTIAL_REQUEST") || has("APP_INSTALLATION_REQUEST")) && /원격|화면.?공유|앱|어플|설치/.test(text)) {
    return result("malicious_app", "rules");
  }
  if (has("MALICIOUS_URL") || has("SMS_LURE") || (/문자|링크|주소|스미싱/.test(text) && has("CREDENTIAL_REQUEST"))) {
    return result("smishing", "rules");
  }
  if (has("PERSONAL_DATA_REQUEST") || has("CREDENTIAL_REQUEST")) {
    return result("personal_information_phishing", "rules");
  }

  const llmType = FRAUD_TYPE_CODES.includes(llm.fraud_type) ? llm.fraud_type : "unknown";
  return result(llmType === "none" ? "unknown" : llmType, "llm_candidate");
}

function result(code, source) {
  return { code, label: FRAUD_TYPES[code], source };
}
