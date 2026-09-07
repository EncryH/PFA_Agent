import test from "node:test";
import assert from "node:assert/strict";

import { getPipelineArchitecture, scoreTransferRisk } from "./orchestrator.js";

test("에이전트 파이프라인은 1~4단계만 노출한다", () => {
  const pipeline = getPipelineArchitecture();
  assert.deepEqual(pipeline.map(({ layer }) => layer), [1, 2, 3, 4]);
  assert.deepEqual(pipeline.map(({ key }) => key), [
    "counterparty-verification",
    "behavior-detection",
    "intent-analysis",
    "damage-response",
  ]);
});

test("빠른 거래 규칙은 독립 에이전트가 아닌 3단계 사전 신호로 합산한다", () => {
  const result = scoreTransferRisk({
    behavior: { verifyVisited: true, sessionSeconds: 120 },
    transaction: {
      amount: 12_000_000,
      isKnownRecipient: false,
      isMyAccount: false,
      hourOfDay: 14,
    },
  });

  assert.equal(result.behaviorScore, 0);
  assert.equal(result.transferSignalScore, 45);
  assert.equal(result.grade, "B");
  assert.ok(result.reasons.includes("미등록 수취인"));
});

test("신고 계좌는 1단계에서 즉시 차단하고 이후 점수를 계산하지 않는다", () => {
  const result = scoreTransferRisk({
    counterparty: { account: "1104421783" },
    behavior: { verifyVisited: true },
    transaction: {
      amount: 10_000,
      isKnownRecipient: false,
      isMyAccount: false,
      hourOfDay: 14,
    },
  });

  assert.equal(result.score, 100);
  assert.equal(result.grade, "D");
  assert.equal(result.stoppedAt, "counterparty-verification");
  assert.equal(result.counterpartyScore, 100);
  assert.equal(result.behaviorScore, 0);
  assert.equal(result.transferSignalScore, 0);
  assert.equal(result.thecheat.reportCount, 7);
});
