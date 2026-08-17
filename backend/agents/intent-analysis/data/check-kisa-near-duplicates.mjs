import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const corpusPath = resolve(process.argv[2] || `${here}/processed/kisa-corpus/kisa-integrated-corpus.json`);
const outputPath = resolve(process.argv[3] || `${here}/processed/kisa-corpus/near-duplicate-report.json`);
const threshold = Number(process.argv[4] || 0.9);

const corpus = JSON.parse(readFileSync(corpusPath, "utf8"));

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/\[(phone|rrn|email|url|account_or_number|ip|counselor)\]/g, "[redacted]")
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

function shingles(text, width = 7) {
  const values = new Set();
  if (text.length <= width) {
    values.add(text);
    return values;
  }
  for (let index = 0; index <= text.length - width; index += 1) {
    values.add(text.slice(index, index + width));
  }
  return values;
}

function jaccard(left, right) {
  const smaller = left.size <= right.size ? left : right;
  const larger = left.size <= right.size ? right : left;
  let intersection = 0;
  for (const value of smaller) {
    if (larger.has(value)) intersection += 1;
  }
  return intersection / (left.size + right.size - intersection);
}

const prepared = corpus.records.map((record) => {
  const normalized = normalize(record.transcript);
  return { record, normalized, shingles: shingles(normalized) };
});

const pairs = [];
for (let leftIndex = 0; leftIndex < prepared.length; leftIndex += 1) {
  for (let rightIndex = leftIndex + 1; rightIndex < prepared.length; rightIndex += 1) {
    const left = prepared[leftIndex];
    const right = prepared[rightIndex];
    const lengthRatio = Math.min(left.normalized.length, right.normalized.length)
      / Math.max(left.normalized.length, right.normalized.length);
    if (lengthRatio < 0.8) continue;

    const similarity = jaccard(left.shingles, right.shingles);
    if (similarity >= threshold) {
      pairs.push({
        left_record_id: left.record.record_id,
        right_record_id: right.record.record_id,
        left_source_set: left.record.source_set,
        right_source_set: right.record.source_set,
        similarity: Number(similarity.toFixed(4)),
      });
    }
  }
}

const report = {
  schema_version: "1.0.0",
  method: "normalized character 7-shingle Jaccard similarity",
  threshold,
  compared_records: prepared.length,
  compared_pairs: (prepared.length * (prepared.length - 1)) / 2,
  near_duplicate_pairs: pairs.length,
  pairs,
};

writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
