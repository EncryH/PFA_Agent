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

test("1층이 CONTINUE 면 1층은 점수를 안 보태고(3층 중복 방지) 2·3층 점수만 합산된다", () => {
  const result = runDefensePipeline({
    counterparty: { account: "9999999999" },
    behavior: { verifyVisited: true },
    transaction: { amount: 100_000, isKnownRecipient: true, hourOfDay: 14 },
  });
  assert.equal(result.counterpartyScore, 0);
  assert.equal(result.score, 0);
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

test("transaction.isKnownRecipient 로 넘긴 known 힌트가 1층까지 역으로 반영된다", () => {
  const result = runDefensePipeline({
    counterparty: { account: "0102345678" }, // 화이트리스트엔 없는 "딸 지혜" 계좌
    behavior: { verifyVisited: true },
    transaction: { amount: 5_000_000, isKnownRecipient: true, hourOfDay: 14 },
  });
  // 프론트의 KNOWN_RECIPIENTS 로 이미 아는 상대라고 알려줬으므로, 3층의 미등록 수취인
  // +20 도 안 붙고(known이므로) 1층도 미확인 페널티 없이 넘어간다.
  assert.equal(result.counterpartyScore, 0);
  assert.equal(result.transactionScore, 15); // 500만원 구간만 (미등록 수취인 +20 없음)
});

test("한도 상향 + 1천만원 이상 조합은 배점과 무관하게 D등급으로 강제된다 (기존 scoreTransferRisk 회귀 방지)", () => {
  const result = scoreTransferRisk({
    behavior: { limitIncreased: 1, verifyVisited: true },
    transaction: { amount: 10_000_000, isKnownRecipient: true, hourOfDay: 14 },
  });
  assert.equal(result.grade, "D");
  assert.equal(result.score, 100);
});
