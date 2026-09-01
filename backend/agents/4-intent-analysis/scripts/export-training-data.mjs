import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const casesRoot = resolve(here, "../datasets/rag/cases");
const inputPath = resolve(process.argv[2] || `${casesRoot}/kisa-intent-review.jsonl`);
const outputPath = resolve(process.argv[3] || `${casesRoot}/kisa-intent-training.jsonl`);

const rows = readFileSync(inputPath, "utf8")
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line));

const approved = rows.filter((row) =>
  row.filter?.label === "fraud_related_candidate"
  && row.extraction?.status === "incident_extracted"
  && row.review?.status === "approved"
  && row.review?.training_eligible === true
  && typeof row.annotation?.fraud === "boolean"
);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, approved.length ? `${approved.map((row) => JSON.stringify(row)).join("\n")}\n` : "", "utf8");

console.log(JSON.stringify({
  outputPath,
  reviewedRows: rows.length,
  trainingRows: approved.length,
  excludedRows: rows.length - approved.length,
}, null, 2));
