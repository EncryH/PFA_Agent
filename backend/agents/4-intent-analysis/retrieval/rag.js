import { readFileSync } from "node:fs";

import { retrieveVectorContext } from "./vector-search.js";
import { retrieveGraphContext } from "./neo4j-search.js";

const corpusUrl = new URL("../datasets/rag/runtime/intent-rag-corpus.json", import.meta.url);
const corpus = JSON.parse(readFileSync(corpusUrl, "utf8"));

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
    method: "local_idf_weighted_lexical_rag",
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
