import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { retrieveIntentContext } from "../retrieval/rag.js";
import { handleIntent } from "../intent.js";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "../../../..");
const envPath = resolve(projectRoot, ".env");

if (existsSync(envPath)) {
  for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
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

const args = process.argv.slice(2);
const fullIntentCheck = args.includes("--full");
const query = args.filter((value) => value !== "--full").join(" ")
  || "검찰에서 계좌가 범죄에 연루됐다며 가족에게 말하지 말고 안전계좌로 옮기라고 했어요";

const result = await retrieveIntentContext({
  transfer: { amount: 12_000_000, is_first_transfer: true, call_in_progress: true },
  messages: [{ role: "user", text: query }],
}, { apiKey: process.env.GEMINI_API_KEY });

const compact = (records) => records.map((record) => ({
  id: record.id,
  score: record.score,
  source: record.source_dataset,
  title: record.title,
  publisher: record.publisher,
  page: record.page,
  excerpt: record.excerpt.slice(0, 180),
}));

console.log(JSON.stringify({
  query,
  method: result.method,
  fraud: compact(result.fraud),
  normal: compact(result.normal),
  official: compact(result.official),
  knowledge_graph: {
    status: result.graph?.status || "disabled",
    method: result.graph?.method,
    paths: (result.graph?.paths || []).map((path) => ({
      fraud_type: path.fraud_type_label,
      score: path.score,
      matched_signals: path.matched_signal_codes,
      chain: path.steps.map((step) => step.label).join(" → "),
    })),
  },
}, null, 2));

if (fullIntentCheck) {
  const intent = await handleIntent({
    transfer: {
      amount: 12_000_000,
      isFirstTransfer: true,
      patternRiskScore: 40,
      callInProgress: true,
    },
    messages: [{ role: "user", text: query }],
    turn: 2,
  }, process.env.GEMINI_API_KEY);

  console.log(JSON.stringify({
    done: intent.done,
    hold: intent.hold,
    risk: intent.risk,
    fraud_type: intent.analysis?.suspected_fraud_type,
    retrieval: intent.analysis?.retrieval,
    message: intent.message,
  }, null, 2));
}
