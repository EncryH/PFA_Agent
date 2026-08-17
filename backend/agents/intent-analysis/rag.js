import { readFileSync } from "node:fs";

const corpusUrl = new URL("./data/processed/runtime/intent-rag-corpus.json", import.meta.url);
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
    }));
}

export function retrieveIntentContext({ messages = [], transfer = {} } = {}) {
  const userText = messages
    .filter((message) => message.role !== "ai")
    .map((message) => message.text)
    .join(" ");
  const query = [
    userText,
    Number(transfer.amount) >= 1_000_000 ? "고액 송금" : "송금",
    transfer.isFirstTransfer !== false ? "처음 보내는 계좌" : "기존 수취인",
  ].join(" ");

  const fraud = search("fraud_context_candidate", query, 3);
  const normal = search("normal_financial_control", query, 3);
  return {
    method: "local_idf_weighted_lexical_rag",
    corpus_version: corpus.schema_version,
    fraud,
    normal,
  };
}

export const ragCorpusSummary = Object.freeze(corpus.summary);
