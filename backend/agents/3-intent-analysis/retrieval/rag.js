import { existsSync, readFileSync } from "node:fs";

import { retrieveVectorContext } from "./vector-search.js";
import { retrieveGraphContext } from "./neo4j-search.js";

const corpusUrl = new URL("../datasets/rag/runtime/intent-rag-corpus.json", import.meta.url);
const EMPTY_CORPUS = Object.freeze({
  schema_version: "embedded-fallback-v1",
  summary: {
    ready: true,
    records: 3,
    fallback: true,
    reason: "intent_rag_corpus_missing",
  },
  records: [
    {
      id: "fallback:fraud:loan-advance-fee",
      kind: "fraud_context_candidate",
      source_dataset: "embedded_fallback",
      review_status: "curated_summary",
      text: "대출 승인, 저금리 전환, 신용등급 조정 등을 이유로 보증금이나 수수료를 먼저 송금하라고 요구하면 대출 선입금 사기 위험 신호로 본다.",
      candidate_signals: ["PREPAY_CONTRADICTION", "SMS_LURE", "CALL_IN_PROGRESS"],
    },
    {
      id: "fallback:normal:known-purpose",
      kind: "normal_financial_control",
      source_dataset: "embedded_fallback",
      review_status: "curated_summary",
      text: "정상 대출은 보증금이나 수수료를 먼저 보내야 승인되는 절차가 아니다. 생활비, 병원비, 경조사비처럼 수취인과 송금 목적을 사용자가 독립적으로 알고 기존 관계나 공식 연락처로 확인되는 경우에만 정상 거래 근거로 본다.",
      normal_actions: ["no_advance_fee_for_loan", "known_recipient", "independent_confirmation"],
    },
    {
      id: "fallback:official:financial-fraud",
      kind: "official_fraud_document",
      source_dataset: "embedded_fallback",
      review_status: "official_summary",
      title: "전기통신금융사기 예방 안내",
      publisher: "금융감독원",
      source_url: "https://www.fss.or.kr/fss/bbs/B0000206/list.do?menuNo=200690",
      page: 1,
      text: "금융회사와 수사기관은 대출 보증금, 안전계좌 이체, 수수료 선납을 이유로 개인에게 먼저 송금을 요구하지 않는다는 예방 안내를 제공한다.",
      usage: "runtime_fallback",
    },
  ],
});

function loadCorpus() {
  if (!existsSync(corpusUrl)) return EMPTY_CORPUS;
  return JSON.parse(readFileSync(corpusUrl, "utf8"));
}

const corpus = loadCorpus();

function normalize(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/[^가-힣a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function features(text = "") {
  const output = new Set();
  for (const word of normalize(text).split(" ")) {
    if (word.length < 2) continue;
    output.add(`w:${word}`);
    if (word.length >= 3) {
      for (let index = 0; index < word.length - 1; index += 1) {
        output.add(`g:${word.slice(index, index + 2)}`);
      }
    }
  }
  return output;
}

const prepared = corpus.records.map((record) => ({
  ...record,
  normalized: normalize(record.text),
  features: features(record.text),
}));

const documentFrequency = new Map();
for (const record of prepared) {
  for (const feature of record.features) {
    documentFrequency.set(feature, (documentFrequency.get(feature) || 0) + 1);
  }
}

function featureWeight(feature) {
  const frequency = documentFrequency.get(feature) || 0;
  return Math.log((prepared.length + 1) / (frequency + 1)) + 1;
}

function excerpt(record, queryWords, length = 520) {
  const text = record.text.replace(/\s+/g, " ").trim();
  const normalizedText = text.toLowerCase();
  const hit = queryWords
    .filter((word) => word.length >= 2)
    .map((word) => normalizedText.indexOf(word))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];
  const start = Math.max(0, (hit ?? 0) - 120);
  const value = text.slice(start, start + length);
  return `${start > 0 ? "…" : ""}${value}${start + length < text.length ? "…" : ""}`;
}

function search(kind, query, limit) {
  const queryFeatures = features(query);
  const queryWords = normalize(query).split(" ");
  const totalWeight = [...queryFeatures].reduce((sum, feature) => sum + featureWeight(feature), 0) || 1;

  return prepared
    .filter((record) => record.kind === kind)
    .map((record) => {
      let matchedWeight = 0;
      for (const feature of queryFeatures) {
        if (record.features.has(feature)) matchedWeight += featureWeight(feature);
      }
      return { record, score: matchedWeight / totalWeight };
    })
    .filter((item) => item.score >= 0.04)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ record, score }) => ({
      id: record.id,
      kind: record.kind,
      source_dataset: record.source_dataset,
      review_status: record.review_status,
      score: Number(score.toFixed(4)),
      excerpt: excerpt(record, queryWords),
      candidate_signals: record.candidate_signals || [],
      normal_actions: record.normal_actions || [],
      document_id: record.document_id,
      title: record.title,
      publisher: record.publisher,
      source_file: record.source_file,
      source_url: record.source_url,
      usage: record.usage,
      page: record.page,
      page_label: record.page_label,
      total_pages: record.total_pages,
      extraction_method: record.extraction_method,
    }));
}

function buildQuery({ messages = [], transfer = {} } = {}) {
  const userText = messages
    .filter((message) => message.role !== "ai")
    .map((message) => message.text)
    .join(" ");
  const query = [
    userText,
    Number(transfer.amount) >= 1_000_000 ? "고액 송금" : "송금",
    (transfer.is_first_transfer ?? transfer.isFirstTransfer) !== false
      ? "처음 보내는 계좌"
      : "기존 수취인",
    (transfer.call_in_progress ?? transfer.callInProgress) ? "상대방과 통화 중" : "",
  ].join(" ");

  return query;
}

function lexicalContext(query) {
  return {
    method: prepared.length ? "local_idf_weighted_lexical_rag" : "rag_unavailable_no_runtime_corpus",
    corpus_version: corpus.schema_version,
    fraud: search("fraud_context_candidate", query, 3),
    normal: search("normal_financial_control", query, 3),
    official: search("official_fraud_document", query, 4),
  };
}

function fillVectorResults(vectorRecords, lexicalRecords, limit = 3) {
  const output = [...vectorRecords];
  const seen = new Set(output.map((record) => record.id));
  for (const record of lexicalRecords) {
    if (output.length >= limit) break;
    if (seen.has(record.id)) continue;
    output.push({ ...record, retrieval_fallback: "lexical" });
    seen.add(record.id);
  }
  return output;
}

export async function retrieveIntentContext(input = {}, {
  apiKey,
  graphConfig = {},
  graphRetriever = retrieveGraphContext,
} = {}) {
  const query = buildQuery(input);
  const lexical = lexicalContext(query);
  const graphPromise = graphRetriever(input, { config: graphConfig });

  if (!apiKey) return { ...lexical, graph: await graphPromise };

  let vector;
  try {
    vector = await retrieveVectorContext(query, apiKey);
  } catch (error) {
    console.warn(`[RAG] 벡터 검색 실패 → 키워드 검색 사용: ${error.message}`);
  }

  const graph = await graphPromise;
  if (!vector) return { ...lexical, graph };

  return {
    ...vector,
    method: "gemini_embedding_vector_search_with_lexical_fill_and_neo4j_graph",
    fraud: fillVectorResults(vector.fraud, lexical.fraud),
    normal: fillVectorResults(vector.normal, lexical.normal),
    official: fillVectorResults(vector.official || [], lexical.official, 4),
    graph,
  };
}

export const ragCorpusSummary = Object.freeze(corpus.summary);
