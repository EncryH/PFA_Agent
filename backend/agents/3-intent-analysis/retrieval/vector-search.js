import { existsSync, readFileSync, statSync } from "node:fs";

import { embedQuery } from "./gemini-embeddings.js";

// 배포본에는 packed 인덱스만 들어간다. 임베딩을 JSON 숫자 배열로 두면 41MB 라
// 저장소에서 제외돼 있었고, 그 결과 서버에서는 벡터 검색이 조용히 꺼진 채
// 키워드 검색으로만 동작했다. float32 를 base64 로 담으면 8MB 로 줄어 커밋된다.
const packedIndexUrl = new URL("../datasets/rag/runtime/intent-vector-index.packed.json", import.meta.url);
// 원본(숫자 배열) 인덱스는 재생성 직후 로컬에서만 쓴다.
const rawIndexUrl = new URL("../datasets/rag/runtime/vector/intent-vector-index.json", import.meta.url);
const DEFAULT_MIN_SIMILARITY = 0.32;

let cachedIndex = null;
let cachedKey = "";

export function encodeEmbedding(values) {
  return Buffer.from(Float32Array.from(values).buffer).toString("base64");
}

export function decodeEmbedding(encoded) {
  const buffer = Buffer.from(encoded, "base64");
  const values = new Float32Array(buffer.byteLength / 4);
  for (let index = 0; index < values.length; index += 1) {
    values[index] = buffer.readFloatLE(index * 4);
  }
  return values;
}

function loadVectorIndex() {
  const url = existsSync(packedIndexUrl) ? packedIndexUrl
    : existsSync(rawIndexUrl) ? rawIndexUrl
    : null;
  if (!url) return null;

  const key = `${url.pathname}:${statSync(url).mtimeMs}`;
  if (cachedIndex && cachedKey === key) return cachedIndex;

  const index = JSON.parse(readFileSync(url, "utf8"));
  for (const record of index.records || []) {
    if (typeof record.embedding === "string") record.embedding = decodeEmbedding(record.embedding);
  }
  cachedIndex = index;
  cachedKey = key;
  return cachedIndex;
}

function dotProduct(left, right) {
  if (left.length !== right.length) return Number.NEGATIVE_INFINITY;
  let score = 0;
  for (let index = 0; index < left.length; index += 1) score += left[index] * right[index];
  return score;
}

function compactExcerpt(text, length = 700) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  return value.length <= length ? value : `${value.slice(0, length).trim()}…`;
}

export function rankVectorRecords(records, queryEmbedding, kind, {
  limit = 3,
  minSimilarity = DEFAULT_MIN_SIMILARITY,
} = {}) {
  const bestByRecord = new Map();

  for (const record of records) {
    if (record.kind !== kind || !record.embedding?.length) continue;
    const score = dotProduct(queryEmbedding, record.embedding);
    if (!Number.isFinite(score) || score < minSimilarity) continue;
    const previous = bestByRecord.get(record.record_id);
    if (!previous || score > previous.score) bestByRecord.set(record.record_id, { record, score });
  }

  return [...bestByRecord.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ record, score }) => ({
      id: record.record_id,
      chunk_id: record.chunk_id,
      kind: record.kind,
      source_dataset: record.source_dataset,
      review_status: record.review_status,
      score: Number(score.toFixed(4)),
      vector_score: Number(score.toFixed(4)),
      excerpt: compactExcerpt(record.text),
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

export async function retrieveVectorContext(query, apiKey, {
  fraudLimit = 3,
  normalLimit = 3,
  officialLimit = 4,
  minSimilarity = Number(process.env.VECTOR_RAG_MIN_SIMILARITY) || DEFAULT_MIN_SIMILARITY,
  index = loadVectorIndex(),
  queryEmbedder = embedQuery,
} = {}) {
  if (!index?.records?.length) return null;

  const queryEmbedding = await queryEmbedder(query, apiKey, {
    model: index.embedding_model,
    dimensions: index.dimensions,
  });

  return {
    method: "gemini_embedding_vector_search",
    corpus_version: index.source_corpus_version,
    vector_index_version: index.schema_version,
    embedding_model: index.embedding_model,
    fraud: rankVectorRecords(index.records, queryEmbedding, "fraud_context_candidate", {
      limit: fraudLimit,
      minSimilarity,
    }),
    normal: rankVectorRecords(index.records, queryEmbedding, "normal_financial_control", {
      limit: normalLimit,
      minSimilarity,
    }),
    official: rankVectorRecords(index.records, queryEmbedding, "official_fraud_document", {
      limit: officialLimit,
      minSimilarity,
    }),
  };
}

export function vectorIndexStatus() {
  const index = loadVectorIndex();
  return index ? {
    ready: true,
    records: index.records?.length || 0,
    model: index.embedding_model,
    dimensions: index.dimensions,
  } : { ready: false, records: 0 };
}
