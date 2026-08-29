import test from "node:test";
import assert from "node:assert/strict";

import { runDefensePipeline, scoreTransferRisk } from "./orchestrator.js";

test("1층에서 화이트리스트로 확정되면 2·3층은 아예 실행되지 않는다", () => {
  const result = runDefensePipeline({
    counterparty: { phone: "1588-5000" },
    behavior: { limitIncreased: 5 }, // 2층이 돌았다면 점수가 붙었을 값
    transaction: { amount: 50_000_000 }, // 3층이 돌았다면 점수가 붙었을 값
  });
  assert.equal(result.grade, "A");
  assert.equal(result.score, 0);
  assert.equal(result.behaviorScore, 0);
  assert.equal(result.transactionScore, 0);
  assert.equal(result.stoppedAt, "counterparty-verification");
});

test("1층에서 더치트 블랙리스트로 확정되면 즉시 D등급으로 차단한다", () => {
  const result = runDefensePipeline({
    counterparty: { account: "1104421783" },
    behavior: {},
    transaction: { amount: 10_000 },
  });
  assert.equal(result.grade, "D");
  assert.equal(result.score, 100);
  assert.equal(result.stoppedAt, "counterparty-verification");
});

test("1층이 CONTINUE 면 1·2·3층 점수가 모두 합산된다", () => {
  const result = runDefensePipeline({
    counterparty: { account: "9999999999" }, // 미확인 상대 — 10점
    behavior: { verifyVisited: true },        // 0점
    transaction: { amount: 100_000, isKnownRecipient: true, hourOfDay: 14 }, // 0점
  });
  assert.equal(result.score, 10);
  assert.equal(result.counterpartyScore, 10);
  assert.equal(result.grade, "A");
});

test("1층에서 미확인 상대로 판단되면 3층의 isKnownRecipient 를 직접 안 넘겨도 반영된다", () => {
  const result = runDefensePipeline({
    counterparty: { account: "9999999999" },
    behavior: { verifyVisited: true },
    transaction: { amount: 5_000_000, hourOfDay: 14 }, // isKnownRecipient 생략
  });
  // 3층 단독이었다면 미등록 수취인 +20 이 붙었어야 하는데, 실제로는 1층이 이미
  // "미확인 상대"를 판정했으므로 isKnownRecipient=false 로 그대로 반영되어 +20 이 나온다.
  assert.equal(result.transactionScore, 15 + 20); // 500만원 구간(15) + 미등록 수취인(20)
});

test("한도 상향 + 1천만원 이상 조합은 배점과 무관하게 D등급으로 강제된다 (기존 scoreTransferRisk 회귀 방지)", () => {
  const result = scoreTransferRisk({
    behavior: { limitIncreased: 1, verifyVisited: true },
    transaction: { amount: 10_000_000, isKnownRecipient: true, hourOfDay: 14 },
  });
  assert.equal(result.grade, "D");
  assert.equal(result.score, 100);
});
