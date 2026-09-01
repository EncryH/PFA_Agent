import { createHash } from "node:crypto";
import {
  existsSync, mkdirSync, readFileSync, writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { embedDocuments, embeddingConfig } from "../retrieval/gemini-embeddings.js";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "../../../..");
const corpusPath = resolve(here, "../datasets/rag/runtime/intent-rag-corpus.json");
const outputPath = resolve(here, "../datasets/rag/runtime/vector/intent-vector-index.json");

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function chunkText(text, maxLength = 1_400, overlap = 160) {
  const value = String(text || "").replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
  if (!value) return [];
  const chunks = [];
  let start = 0;

  while (start < value.length) {
    let end = Math.min(value.length, start + maxLength);
    if (end < value.length) {
      const boundaryStart = start + Math.floor(maxLength * 0.65);
      const boundary = Math.max(
        value.lastIndexOf("\n", end),
        value.lastIndexOf(". ", end),
        value.lastIndexOf("요. ", end),
        value.lastIndexOf("다. ", end),
      );
      if (boundary >= boundaryStart) end = boundary + 1;
    }
    chunks.push(value.slice(start, end).trim());
    if (end >= value.length) break;
    start = Math.max(start + 1, end - overlap);
  }
  return chunks.filter(Boolean);
}

function createChunks(records) {
  return records.flatMap((record) => chunkText(record.text).map((text, index) => ({
    chunk_id: `${record.id}#${index + 1}`,
    record_id: record.id,
    kind: record.kind,
    source_dataset: record.source_dataset,
    review_status: record.review_status,
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
    text,
  })));
}

function saveIndex(metadata, records) {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify({ ...metadata, records }, null, 2)}\n`, "utf8");
}

loadEnv(resolve(projectRoot, ".env"));

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error("루트 .env에 GEMINI_API_KEY가 필요합니다");

const corpusRaw = readFileSync(corpusPath, "utf8");
const corpus = JSON.parse(corpusRaw);
const corpusHash = createHash("sha256").update(corpusRaw).digest("hex");
const chunks = createChunks(corpus.records || []);
const { model, dimensions } = embeddingConfig();
const batchSize = Math.max(1, Math.min(50, Number(process.env.VECTOR_INDEX_BATCH_SIZE) || 25));

const metadata = {
  schema_version: "1.0.0",
  generated_at: new Date().toISOString(),
  source_corpus: "intent-rag-corpus.json",
  source_corpus_version: corpus.schema_version,
  source_corpus_sha256: corpusHash,
  embedding_model: model,
  dimensions,
  chunking: { max_characters: 1_400, overlap_characters: 160 },
};

let completed = [];
if (existsSync(outputPath)) {
  const existing = JSON.parse(readFileSync(outputPath, "utf8"));
  const compatible = existing.embedding_model === model
    && existing.dimensions === dimensions;
  if (compatible) {
    const currentChunks = new Map(chunks.map((chunk) => [chunk.chunk_id, chunk]));
    completed = (existing.records || []).filter((record) => {
      const current = currentChunks.get(record.chunk_id);
      return current?.text === record.text;
    });
  }
}

const completedIds = new Set(completed.map((record) => record.chunk_id));
const pending = chunks.filter((chunk) => !completedIds.has(chunk.chunk_id));
console.log(JSON.stringify({ total_chunks: chunks.length, resumed: completed.length, pending: pending.length, model, dimensions }, null, 2));

for (let offset = 0; offset < pending.length; offset += batchSize) {
  const batch = pending.slice(offset, offset + batchSize);
  const embeddings = await embedDocuments(batch.map((chunk) => chunk.text), apiKey, { model, dimensions });
  completed.push(...batch.map((chunk, index) => ({ ...chunk, embedding: embeddings[index] })));
  saveIndex({ ...metadata, generated_at: new Date().toISOString() }, completed);
  console.log(`[vector-index] ${completed.length}/${chunks.length}`);
}

const order = new Map(chunks.map((chunk, index) => [chunk.chunk_id, index]));
completed.sort((left, right) => order.get(left.chunk_id) - order.get(right.chunk_id));
saveIndex({ ...metadata, generated_at: new Date().toISOString() }, completed);
console.log(JSON.stringify({ outputPath, records: completed.length, model, dimensions }, null, 2));
