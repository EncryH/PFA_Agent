import { existsSync, readFileSync, statSync } from "node:fs";

import { embedQuery } from "./gemini-embeddings.js";

const indexUrl = new URL("../datasets/rag/runtime/vector/intent-vector-index.json", import.meta.url);
const DEFAULT_MIN_SIMILARITY = 0.32;

let cachedIndex = null;
let cachedMtime = -1;

function loadVectorIndex() {
  if (!existsSync(indexUrl)) return null;
  const mtime = statSync(indexUrl).mtimeMs;
  if (cachedIndex && cachedMtime === mtime) return cachedIndex;
  cachedIndex = JSON.parse(readFileSync(indexUrl, "utf8"));
  cachedMtime = mtime;
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
    if (record.kind !== kind || !Array.isArray(record.embedding)) continue;
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
