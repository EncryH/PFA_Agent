import { extractRuleSignals } from "../rules/signals.js";
import {
  executeNeo4jQuery,
  resolveNeo4jConfig,
} from "./neo4j-client.js";

const MATCH_TYPES_QUERY = `
  MATCH (f:FraudType)
  OPTIONAL MATCH (f)-[hs:HAS_SIGNAL]->(s:RiskSignal)
  WITH f, collect({code: s.code, weight: coalesce(hs.weight, 1)}) AS signalLinks
  OPTIONAL MATCH (f)-[:USES_CHANNEL]->(c:Channel)
  WITH f, signalLinks, collect(DISTINCT c.code) AS channelCodes
  OPTIONAL MATCH (f)-[:IMPERSONATES]->(i:Impersonator)
  WITH f, signalLinks, channelCodes, collect(DISTINCT i.code) AS impersonatorCodes
  OPTIONAL MATCH (f)-[:REQUESTS]->(a:RequestedAction)
  WITH f, signalLinks, channelCodes, impersonatorCodes, collect(DISTINCT a.code) AS actionCodes
  WITH f, signalLinks, channelCodes, impersonatorCodes, actionCodes,
    reduce(total = 0, link IN signalLinks |
      total + CASE WHEN link.code IN $signalCodes THEN link.weight ELSE 0 END
    )
    + size([code IN channelCodes WHERE code IN $channelCodes]) * 2
    + size([code IN impersonatorCodes WHERE code IN $impersonatorCodes]) * 4
    + size([code IN actionCodes WHERE code IN $requestedActionCodes]) * 3
    + CASE WHEN f.code IN $fraudTypeHints THEN 5 ELSE 0 END AS score
  WHERE score > 0
  RETURN f.code AS code, f.label AS label, f.summary AS summary, score,
    [link IN signalLinks WHERE link.code IN $signalCodes | link.code] AS matchedSignalCodes,
    [code IN channelCodes WHERE code IN $channelCodes] AS matchedChannelCodes,
    [code IN impersonatorCodes WHERE code IN $impersonatorCodes] AS matchedImpersonatorCodes,
    [code IN actionCodes WHERE code IN $requestedActionCodes] AS matchedActionCodes
  ORDER BY score DESC, f.code
  LIMIT $limit
`;

const LOAD_PATHS_QUERY = `
  MATCH (f:FraudType)
  WHERE f.code IN $fraudTypeCodes
  OPTIONAL MATCH (f)-[:HAS_STEP]->(step:AttackStep)
  OPTIONAL MATCH (step)-[:AT_STAGE]->(stage:AttackStage)
  WITH f, collect(DISTINCT {
    order: step.order,
    label: step.label,
    stage: stage.code,
    stageLabel: stage.label
  }) AS steps
  OPTIONAL MATCH (f)-[:RECOMMENDS]->(action:SafetyAction)
  RETURN f.code AS code, steps,
    collect(DISTINCT {order: action.order, label: action.label}) AS safetyActions
`;

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function matches(text, pattern, value, output) {
  if (pattern.test(text)) output.push(value);
}

export function deriveGraphLookup({ messages = [], transfer = {} } = {}) {
  const text = messages
    .filter((message) => message.role !== "ai")
    .map((message) => String(message.text || ""))
    .join(" ");
  const signalCodes = extractRuleSignals(messages, transfer);
  const channelCodes = [];
  const impersonatorCodes = [];
  const requestedActionCodes = [];
  const fraudTypeHints = [];

  matches(text, /전화|통화|070|대표번호/, "phone", channelCodes);
  matches(text, /문자|SMS|스미싱/i, "sms", channelCodes);
  matches(text, /카카오톡|카톡|메신저|리딩방|단체방/, "messenger", channelCodes);
  matches(text, /웹|사이트|홈페이지|링크|URL/i, "web", channelCodes);
  matches(text, /앱|어플|프로그램|원격제어/, "app", channelCodes);
  matches(text, /직접\s*만|대면/, "face_to_face", channelCodes);

  matches(text, /검찰|검사|수사관/, "prosecution", impersonatorCodes);
  matches(text, /경찰/, "police", impersonatorCodes);
  matches(text, /금감원|금융감독원/, "financial_supervisory_service", impersonatorCodes);
  matches(text, /은행|금융회사|카드사|증권사/, "bank", impersonatorCodes);
  matches(text, /국세청|세무서/, "tax_office", impersonatorCodes);
  matches(text, /구청|정부|공공기관|국가기관/, "government_agency", impersonatorCodes);
  matches(text, /택배|우체국|배송/, "delivery_company", impersonatorCodes);
  matches(text, /아들|딸|손자|손녀|엄마|아빠|어머니|아버지|가족/, "family", impersonatorCodes);
  matches(text, /친구|지인|동료/, "acquaintance", impersonatorCodes);
  matches(text, /업체|회사|상담사|직원|전문가/, "company", impersonatorCodes);

  matches(text, /송금|입금|이체|돈을\s*(보내|옮기)/, "transfer", requestedActionCodes);
  matches(text, /(?:앱|어플|프로그램).{0,8}(?:설치|깔)|(?:설치|깔).{0,8}(?:앱|어플|프로그램)/, "install_app", requestedActionCodes);
  matches(text, /원격\s*제어|화면\s*공유/, "remote_control", requestedActionCodes);
  matches(text, /OTP|인증\s*번호|보안\s*카드/i, "share_otp", requestedActionCodes);
  matches(text, /(?:링크|URL|주소).{0,8}(?:누르|클릭|접속)|(?:누르|클릭|접속).{0,8}(?:링크|URL|주소)/i, "click_url", requestedActionCodes);
  matches(text, /신분증/, "submit_id", requestedActionCodes);
  matches(text, /주민\s*번호|개인\s*정보|계좌\s*정보/, "submit_personal_information", requestedActionCodes);
  matches(text, /통화.{0,8}(유지|끊지)|전화.{0,8}끊지/, "keep_call", requestedActionCodes);
  matches(text, /비밀|말하지|알리지/, "keep_secret", requestedActionCodes);
  matches(text, /추가.{0,8}(입금|송금)|세금|수수료|보증금|예치금/, "additional_payment", requestedActionCodes);
  matches(text, /투자금|주식|코인|가상.?자산|리딩/, "investment_deposit", requestedActionCodes);

  matches(text, /검찰|경찰|금감원|금융감독원|안전\s*계좌|보호\s*계좌/, "institution_impersonation", fraudTypeHints);
  matches(text, /대출|저금리|한도\s*상향|대환/, "loan_advance_fee", fraudTypeHints);
  matches(text, /환급|당첨|지원금|보상금/, "refund_advance_fee", fraudTypeHints);
  matches(text, /아들|딸|손자|손녀|가족|지인/, "family_or_acquaintance_impersonation", fraudTypeHints);
  matches(text, /스미싱|택배.{0,12}링크|과태료.{0,12}링크|청첩장.{0,12}링크/, "smishing", fraudTypeHints);
  matches(text, /원격\s*제어|화면\s*공유|악성\s*앱/, "malicious_app", fraudTypeHints);
  matches(text, /주민\s*번호|신분증|개인\s*정보|OTP|인증\s*번호/i, "personal_information_phishing", fraudTypeHints);
  matches(text, /투자|주식|코인|가상.?자산|리딩방|원금\s*보장|수익\s*보장/, "investment_fraud", fraudTypeHints);
  matches(text, /부업|미션|과제|리뷰|구매\s*대행|팀\s*미션/, "job_or_mission_fraud", fraudTypeHints);

  return {
    signalCodes: unique(signalCodes),
    channelCodes: unique(channelCodes),
    impersonatorCodes: unique(impersonatorCodes),
    requestedActionCodes: unique(requestedActionCodes),
    fraudTypeHints: unique(fraudTypeHints),
  };
}

function cleanItems(items = []) {
  return items
    .filter((item) => item && item.label && Number.isFinite(Number(item.order)))
    .map((item) => ({ ...item, order: Number(item.order) }))
    .sort((left, right) => left.order - right.order);
}

export async function retrieveGraphContext(input = {}, {
  config = {},
  queryExecutor = executeNeo4jQuery,
  limit = 3,
} = {}) {
  const resolved = resolveNeo4jConfig(config);
  if (!resolved.enabled) {
    return { status: "disabled", method: "neo4j_fixed_cypher", paths: [] };
  }

  const lookup = deriveGraphLookup(input);
  const hasLookup = Object.values(lookup).some((values) => values.length > 0);
  if (!hasLookup) {
    return {
      status: "ready",
      method: "neo4j_fixed_cypher",
      matched_entities: lookup,
      paths: [],
    };
  }

  try {
    const matches = await queryExecutor(MATCH_TYPES_QUERY, { ...lookup, limit }, resolved);
    const codes = matches.map((item) => item.code).filter(Boolean);
    const details = codes.length
      ? await queryExecutor(LOAD_PATHS_QUERY, { fraudTypeCodes: codes }, resolved)
      : [];
    const detailByCode = new Map(details.map((item) => [item.code, item]));
    const paths = matches.map((item) => {
      const detail = detailByCode.get(item.code) || {};
      return {
        fraud_type_code: item.code,
        fraud_type_label: item.label,
        summary: item.summary,
        score: Number(item.score) || 0,
        matched_signal_codes: unique(item.matchedSignalCodes || []),
        matched_channel_codes: unique(item.matchedChannelCodes || []),
        matched_impersonator_codes: unique(item.matchedImpersonatorCodes || []),
        matched_action_codes: unique(item.matchedActionCodes || []),
        steps: cleanItems(detail.steps),
        safety_actions: cleanItems(detail.safetyActions),
      };
    });
    return {
      status: "ready",
      method: "neo4j_fixed_cypher",
      matched_entities: lookup,
      paths,
    };
  } catch (error) {
    console.warn(`[GraphRAG] Neo4j 검색 실패 → Vector RAG만 사용: ${error.message}`);
    return {
      status: "unavailable",
      method: "neo4j_fixed_cypher",
      error_code: String(error.message || "NEO4J_ERROR").split(":")[0],
      matched_entities: lookup,
      paths: [],
    };
  }
}

export function formatGraphContext(graph = {}) {
  if (!graph.paths?.length) return "[지식그래프 관계 근거]\n검색 결과 없음";
  return [
    "[지식그래프 관계 근거]",
    "현재 대화에서 확인된 항목과 연결되는 사기 진행 흐름입니다. 대화에 없는 단계는 실제 발생으로 단정하지 마세요.",
    ...graph.paths.map((path, index) => {
      const chain = path.steps.map((step) => step.label).join(" → ");
      const actions = path.safety_actions.map((action) => `${action.order}. ${action.label}`).join(" ");
      return [
        `${index + 1}. 유형=${path.fraud_type_label} / 관계점수=${path.score}`,
        `일치 신호=${path.matched_signal_codes.join(", ") || "없음"}`,
        `진행 흐름=${chain || "없음"}`,
        `대응=${actions || "없음"}`,
      ].join("\n");
    }),
  ].join("\n\n");
}
