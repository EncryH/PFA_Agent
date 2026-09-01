import {
  existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ragRoot = resolve(here, "../datasets/rag");
const sourceJson = resolve(ragRoot, "input");
const outputPath = resolve(ragRoot, "runtime", "intent-rag-corpus.json");

const core = JSON.parse(
  readFileSync(resolve(sourceJson, "kisa-corpus", "kisa-integrated-corpus.json"), "utf8"),
);
const auxiliary = JSON.parse(
  readFileSync(resolve(sourceJson, "kisa-auxiliary-consultations.json"), "utf8"),
);
const pdfPagesPath = resolve(sourceJson, "pdf-pages.json");
const officialPdfPages = existsSync(pdfPagesPath)
  ? JSON.parse(readFileSync(pdfPagesPath, "utf8")).records || []
  : [];

const riskTerms = new Set([
  "보이스피싱", "피싱", "스미싱", "송금", "계좌", "검찰", "경찰",
  "앱", "수수료", "안전계좌", "개인정보", "문자", "링크",
]);

const fraudCases = [];
for (const record of core.records) {
  if (!(record.matched_keywords || []).some((term) => riskTerms.has(term))) continue;
  fraudCases.push({
    id: record.record_id,
    kind: "fraud_context_candidate",
    source_dataset: "kisa_synthetic_300",
    review_status: record.annotation?.reviewed ? "reviewed" : "needs_review",
    text: record.transcript,
    candidate_signals: record.matched_keywords || [],
  });
}

for (const record of auxiliary.records) {
  const uses = record.candidate_classification?.candidate_uses || [];
  if (!uses.includes("stage_4_intent_risk_candidate")) continue;
  fraudCases.push({
    id: record.record_id,
    kind: "fraud_context_candidate",
    source_dataset: "kisa_synthetic_auxiliary_982",
    review_status: record.annotation?.review_status || "needs_review",
    text: record.transcript,
    candidate_signals: [
      ...(record.candidate_classification?.requested_action_candidates || []),
      ...(record.candidate_classification?.risk_signal_candidates || []),
    ],
  });
}

const normalRoot = resolve(sourceJson, "aihub-normal-finance", "qa");
const normalFiles = readdirSync(normalRoot)
  .filter((name) => name.endsWith(".json") && name.includes("-bank-"))
  .sort();

const bucketTargets = new Map([
  ["transfer", 100],
  ["loan", 100],
  ["deposit", 100],
  ["transaction", 100],
]);
const bucketCounts = new Map([...bucketTargets.keys()].map((key) => [key, 0]));
const normalCases = [];

function normalBucket(actions = []) {
  if (actions.some((value) => [
    "funds_transfer_or_account_restriction",
    "erroneous_transfer_support",
    "automatic_transfer_management",
  ].includes(value))) return "transfer";
  if (actions.some((value) => [
    "loan_inquiry_or_management",
    "credit_or_collateral_loan",
  ].includes(value))) return "loan";
  if (actions.some((value) => [
    "deposit_maturity_or_termination",
    "tax_advantaged_product",
  ].includes(value))) return "deposit";
  if (actions.some((value) => [
    "transaction_or_balance_inquiry",
    "interest_or_overdue_payment",
    "transaction_limit_management",
  ].includes(value))) return "transaction";
  return null;
}

function targetsFilled() {
  return [...bucketTargets].every(([key, target]) => bucketCounts.get(key) >= target);
}

for (const file of normalFiles) {
  if (targetsFilled()) break;
  const chunk = JSON.parse(readFileSync(resolve(normalRoot, file), "utf8"));
  for (const record of chunk.records) {
    if (targetsFilled()) break;
    if (record.normal_intent?.partition_status === "excluded_cross_split_overlap") continue;

    const actions = record.normal_intent?.requested_action || [];
    const bucket = normalBucket(actions);
    if (!bucket || bucketCounts.get(bucket) >= bucketTargets.get(bucket)) continue;

    const conversation = record.conversation || {};
    const text = [
      record.annotation?.consulting_purpose,
      conversation.customer_question,
      conversation.customer_follow_up_question,
      record.expected_output,
    ].filter(Boolean).join("\n");
    if (!text.trim()) continue;

    normalCases.push({
      id: record.record_id,
      kind: "normal_financial_control",
      source_dataset: "aihub_normal_finance",
      review_status: "dataset_role_assumption",
      bucket,
      text,
      normal_actions: actions,
    });
    bucketCounts.set(bucket, bucketCounts.get(bucket) + 1);
  }
}

const output = {
  schema_version: "1.1.0",
  dataset_name: "안심동행 AI 송금 의도 분석 실행용 RAG Corpus",
  generated_at: new Date().toISOString(),
  cautions: [
    "KISA 상담은 합성데이터이며 미검수 레코드를 실제 피해 사건으로 표시하지 않는다.",
    "AI Hub 정상 라벨은 데이터셋 역할에 따른 대조군 가정이다.",
    "공식 PDF 페이지는 설명 근거이며 이미지 기반 Gemini 요약 페이지는 검수 전 직접 인용하지 않는다.",
    "검색 결과는 LLM의 비교 근거일 뿐 최종 위험 점수는 규칙 엔진이 결정한다.",
  ],
  summary: {
    fraud_context_candidates: fraudCases.length,
    normal_financial_controls: normalCases.length,
    official_pdf_documents: new Set(officialPdfPages.map((record) => record.document_id)).size,
    official_pdf_pages: officialPdfPages.length,
    normal_bucket_counts: Object.fromEntries(bucketCounts),
  },
  records: [...fraudCases, ...normalCases, ...officialPdfPages],
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ outputPath, ...output.summary }, null, 2));
