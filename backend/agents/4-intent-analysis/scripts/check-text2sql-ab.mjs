import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

import { handleIntent } from "../intent.js";
import { closeText2SqlClient } from "../text2sql/client.js";

const apiKey = process.env.GEMINI_API_KEY || "";
if (!apiKey) throw new Error("GEMINI_API_KEY가 없습니다.");

const input = {
  transfer: {
    userId: "demo-parent-01",
    amount: 12_000_000,
    bank: "수협",
    recipientName: "김수형",
    occurredAt: "2026-08-31T18:00:00+09:00",
    isFirstTransfer: true,
    patternRiskScore: 0,
    callInProgress: false,
  },
  messages: [{
    role: "user",
    text: "문자로 연락 온 처음 보는 업체가 오늘 안에 계약금을 빨리 보내야 한다며 새 계좌로 1,200만원을 보내달래요.",
  }],
  turn: 8,
};

async function run(label, databaseConfig) {
  const startedAt = performance.now();
  const result = await handleIntent(input, apiKey, { databaseConfig });
  const pattern = result.analysis?.retrieval?.transaction_pattern || {};
  return {
    label,
    elapsed_ms: Math.round(performance.now() - startedAt),
    risk_level: result.risk?.level,
    risk_score: result.risk?.score,
    risk_components: result.risk?.components,
    transaction_pattern: {
      status: pattern.status,
      recipient_known: pattern.recipient_known,
      average_transfer_amount: pattern.average_transfer_amount,
      maximum_transfer_amount: pattern.maximum_transfer_amount,
      risk_score: pattern.risk_score,
      risk_reasons: pattern.risk_reasons,
    },
    hold: result.hold,
    done: result.done,
    message: result.message,
  };
}

try {
  const withoutPattern = await run("거래 패턴 OFF", { enabled: false });
  const withPattern = await run("거래 패턴 ON", {});

  assert.equal(withoutPattern.transaction_pattern.status, "disabled");
  assert.equal(withPattern.transaction_pattern.status, "ready");
  assert.ok(withPattern.transaction_pattern.risk_score >= 30);
  assert.ok(withPattern.risk_score > withoutPattern.risk_score);
  assert.equal(withPattern.risk_components.pattern, withPattern.transaction_pattern.risk_score);

  console.log(JSON.stringify({
    result: "PASS",
    scenario: input.messages[0].text,
    comparison: [withoutPattern, withPattern],
    score_difference: withPattern.risk_score - withoutPattern.risk_score,
  }, null, 2));
} finally {
  await closeText2SqlClient();
}
