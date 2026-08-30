import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ragRoot = resolve(here, "../datasets/rag");
const inputPath = resolve(process.argv[2] || `${ragRoot}/cases/kisa-consultations.json`);
const outputPath = resolve(process.argv[3] || `${ragRoot}/cases/kisa-intent-review.jsonl`);

const source = JSON.parse(readFileSync(inputPath, "utf8"));

const tests = {
  directFraud: /보이스피싱|스미싱|피싱|사칭|사기범|사기 전화/,
  money: /송금|입금|이체|계좌|수수료|보증금|안전계좌|돈을\s*(?:보내|옮기|입금)/,
  impersonation: /검찰|경찰|금감원|금융감독원|은행|국세청|구청|시청|정부기관|택배|가족|자녀|손자|지인/,
  contact: /전화|통화|문자|카카오톡|카톡|메신저|이메일|링크|URL|사이트/,
  information: /주민등록번호|신분증|개인정보|비밀번호|인증번호|OTP|계정|아이디|입력하|알려달/,
  app: /앱을?\s*(?:설치|깔)|원격제어|화면\s*공유/,
  urgency: /지금\s*당장|오늘까지|빨리|늦으면|긴급|시간이\s*없/,
  secrecy: /비밀|말하지\s*말|알리지\s*말|은행 직원에게.*(?:숨기|다른 말)/,
  safeAccount: /안전계좌|보호계좌|국가안전계좌|계좌가.*(?:위험|연루).*(?:옮기|이체)/,
  completedLoss: /송금했|입금했|이체했|돈을\s*보냈|피해를\s*(?:입|봤)|돈이\s*빠져/,
};

const adviceLine = /문의하|안내|신고하|차단하|예방|조치|연락처|번호\s*메모|참고하|대응하지|상담센터|민원\s*담당|도움을\s*드|확인해\s*드|가능하실|말씀해\s*주|해\s*보셔야|해보시는|하시면\s*됩니다|보내드|진행해\s*주|국번\s*없이|경찰청\s*민원센터|사이버수사대|검색창에|저희\s*(?:쪽|기관|측|는)|고객님|선생님/;
const incidentLine = /받았|왔는데|연락|문자|전화|통화|링크|사이트|입력|설치|깔았|요구|말했|하라고|송금|입금|이체|계좌|수수료|보이스피싱|스미싱|피싱|사칭|검찰|경찰|금감원|은행|국세청|택배|개인정보|주민등록번호|비밀번호|OTP|피해/;
const victimSituationLine = /제가|저는|저희\s*(?!쪽|기관|측|는)|부모님|받았|왔는데|연락이|문자가|전화가|통화했|알려줬|입력했|입력하는|입력하라는|클릭했|접속했|설치했|깔았|보냈|송금했|입금했|이체했|빠져|달라고|하라고|요구받|피해를\s*(?:입|봤|당)|걱정돼|의심돼|이상해서|느껴|보였|같아서|들어가보니|찾아보니/;

const unique = (items) => [...new Set(items)];
const includes = (text, regex) => regex.test(text);

function extractIncidentDescription(transcript) {
  const lines = transcript
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const selected = lines.filter((line) =>
    incidentLine.test(line)
    && victimSituationLine.test(line)
    && !adviceLine.test(line)
    && !/[?？]\s*$/.test(line)
  );
  return unique(selected).slice(0, 8).join(" ");
}

function buildAnnotation(text) {
  const fraudType = [];
  const channel = [];
  const impersonation = [];
  const requestedAction = [];
  const riskSignals = [];

  if (/보이스피싱|검찰|경찰|금감원|금융감독원|국세청|구청|시청|정부기관|출석\s*요구|영장/.test(text)) fraudType.push("institution_impersonation");
  if (/대출.*(?:수수료|보증금|선입금)|(?:수수료|보증금).*대출/.test(text)) fraudType.push("loan_advance_fee");
  if (/환급.*(?:수수료|선입금)|(?:수수료|선입금).*환급/.test(text)) fraudType.push("refund_advance_fee");
  if (/가족|자녀|아들|딸|손자|손녀|지인/.test(text) && /사칭|급전|돈을\s*보내/.test(text)) fraudType.push("family_or_acquaintance_impersonation");
  if (/스미싱|문자.*(?:링크|URL|사이트)/.test(text)) fraudType.push("smishing");
  if (tests.app.test(text)) fraudType.push("malicious_app");
  if (tests.information.test(text)) fraudType.push("personal_information_phishing");
  if (fraudType.length === 0 && tests.directFraud.test(text)) fraudType.push("other");

  if (/전화|통화/.test(text)) channel.push("phone");
  if (/문자|SMS/.test(text)) channel.push("sms");
  if (/카카오톡|카톡/.test(text)) channel.push("kakao");
  if (/메신저/.test(text)) channel.push("messenger");
  if (/링크|URL|사이트|웹/.test(text)) channel.push("web");
  if (/이메일|메일/.test(text)) channel.push("email");
  if (/앱|어플/.test(text)) channel.push("app");

  if (/검찰/.test(text)) impersonation.push("prosecution");
  if (/경찰/.test(text)) impersonation.push("police");
  if (/금감원|금융감독원/.test(text)) impersonation.push("financial_supervisory_service");
  if (/은행/.test(text)) impersonation.push("bank");
  if (/구청|시청|정부기관|공공기관/.test(text)) impersonation.push("government_agency");
  if (/국세청|세무서/.test(text)) impersonation.push("tax_office");
  if (/택배|우체국/.test(text)) impersonation.push("delivery_company");
  if (/가족|자녀|아들|딸|손자|손녀/.test(text)) impersonation.push("family");
  if (/지인|친구/.test(text)) impersonation.push("acquaintance");

  if (/송금|입금|이체|돈을\s*(?:보내|옮기)/.test(text)) requestedAction.push("transfer");
  if (tests.app.test(text)) requestedAction.push("install_app");
  if (/개인정보|주민등록번호|비밀번호|인증번호|계정|아이디/.test(text) && /입력|알려|제출|전달/.test(text)) requestedAction.push("submit_personal_information");
  if (/신분증/.test(text) && /보내|찍|제출/.test(text)) requestedAction.push("submit_id");
  if (/OTP|인증번호/.test(text) && /알려|전달|입력/.test(text)) requestedAction.push("share_otp");
  if (/링크|URL|사이트/.test(text) && /클릭|접속|들어가|눌렀/.test(text)) requestedAction.push("click_url");
  if (/전화.*(?:걸|하라고)|연락.*(?:하라고|달라고)/.test(text)) requestedAction.push("call_back");
  if (/원격제어|화면\s*공유/.test(text)) requestedAction.push("remote_control");
  if (/통화.*(?:끊지|유지)|전화.*끊지/.test(text)) requestedAction.push("keep_call");
  if (tests.secrecy.test(text)) requestedAction.push("keep_secret");

  if (tests.safeAccount.test(text)) riskSignals.push("SAFE_ACCOUNT_TRANSFER");
  if (tests.secrecy.test(text)) riskSignals.push("SECRECY_INSTRUCTION");
  if (/받으려면.*(?:먼저|선입금)|(?:수수료|보증금|세금).*먼저/.test(text)) riskSignals.push("PREPAY_CONTRADICTION");
  if (/비밀번호|인증번호|OTP|원격제어|화면\s*공유/.test(text)) riskSignals.push("CREDENTIAL_REQUEST");
  if (/지금.*통화|통화\s*중|끊지\s*말/.test(text)) riskSignals.push("CALL_IN_PROGRESS");
  if (tests.impersonation.test(text) && tests.directFraud.test(text)) riskSignals.push("AGENCY_IMPERSONATION");
  if (tests.urgency.test(text)) riskSignals.push("URGENCY");
  if (/링크|URL|피싱사이트|의심.*사이트/.test(text)) riskSignals.push("MALICIOUS_URL");
  if (/문자/.test(text) && /링크|피싱|스미싱|사칭|출석/.test(text)) riskSignals.push("SMS_LURE");
  if (tests.information.test(text)) riskSignals.push("PERSONAL_DATA_REQUEST");
  if (tests.app.test(text)) riskSignals.push("APP_INSTALLATION_REQUEST");

  let attackStage = "unknown";
  if (tests.contact.test(text)) attackStage = "approach";
  if (impersonation.length) attackStage = "trust_building";
  if (requestedAction.some((item) => ["submit_personal_information", "submit_id", "share_otp", "click_url", "install_app", "remote_control"].includes(item))) attackStage = "information_theft";
  if (requestedAction.includes("transfer") || /수수료|보증금|안전계좌/.test(text)) attackStage = "money_request";
  if (tests.completedLoss.test(text)) attackStage = "loss_completed";

  return {
    fraud: null,
    fraud_type: unique(fraudType),
    channel: unique(channel).length ? unique(channel) : ["unknown"],
    impersonation: unique(impersonation).length ? unique(impersonation) : ["unknown"],
    requested_action: unique(requestedAction).length ? unique(requestedAction) : ["unknown"],
    risk_signals: unique(riskSignals),
    attack_stage: attackStage,
  };
}

function relevanceScore(text) {
  return (includes(text, tests.directFraud) ? 3 : 0)
    + (includes(text, tests.money) ? 2 : 0)
    + (includes(text, tests.impersonation) ? 1 : 0)
    + (includes(text, tests.contact) ? 1 : 0)
    + (includes(text, tests.information) ? 1 : 0)
    + (includes(text, tests.app) ? 2 : 0);
}

const rows = source.records.map((record) => {
  const incidentDescription = extractIncidentDescription(record.transcript);
  const score = relevanceScore(incidentDescription || record.transcript);
  const annotation = buildAnnotation(incidentDescription);

  return {
    schema_version: "1.0.0",
    case_id: record.id,
    source: {
      dataset: source.dataset_name,
      source_file: record.source_file,
      synthetic: true,
      redaction_applied: source.redaction_applied,
    },
    filter: {
      label: score >= 3 ? "fraud_related_candidate" : "normal_or_irrelevant_candidate",
      heuristic_score: score,
      method: "keyword_heuristic_v1",
    },
    extraction: {
      status: incidentDescription ? "incident_extracted" : "no_incident_found",
      method: "incident_keyword_heuristic_v1",
    },
    incident_description: incidentDescription,
    annotation,
    review: {
      status: "needs_review",
      training_eligible: false,
      reviewer: null,
      reviewed_at: null,
    },
  };
});

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");

const related = rows.filter((row) => row.filter.label === "fraud_related_candidate").length;
console.log(JSON.stringify({ outputPath, total: rows.length, fraudRelatedCandidates: related, needsReview: rows.length }, null, 2));
