import test from "node:test";
import assert from "node:assert/strict";

import { runTransactionRiskAgent } from "../agent.js";

test("등록된 수취인에게 낮에 보내는 소액은 0점 — 무마찰 통과", () => {
  const result = runTransactionRiskAgent({ amount: 100_000, isKnownRecipient: true, hourOfDay: 14 });
  assert.equal(result.score, 0);
  assert.deepEqual(result.reasons, []);
});

test("미등록 수취인은 본인 계좌가 아닌 한 20점", () => {
  const result = runTransactionRiskAgent({ isKnownRecipient: false, isMyAccount: false });
  assert.equal(result.score, 20);
});

test("본인 계좌 간 이체는 미등록 수취인 감점을 받지 않는다", () => {
  const result = runTransactionRiskAgent({ isKnownRecipient: false, isMyAccount: true });
  assert.equal(result.score, 0);
});

test("금액 구간별로 점수가 늘어난다 — 100만/300만/1천만/3천만", () => {
  const known = { isKnownRecipient: true, hourOfDay: 14 };
  assert.equal(runTransactionRiskAgent({ ...known, amount: 1_000_000 }).score, 8);
  assert.equal(runTransactionRiskAgent({ ...known, amount: 3_000_000 }).score, 15);
  assert.equal(runTransactionRiskAgent({ ...known, amount: 10_000_000 }).score, 25);
  assert.equal(runTransactionRiskAgent({ ...known, amount: 30_000_000 }).score, 35);
});

test("야간(23시~6시) 이체는 15점이 붙는다", () => {
  const result = runTransactionRiskAgent({ isKnownRecipient: true, hourOfDay: 2 });
  assert.equal(result.score, 15);
});

test("미등록 수취인에게 야간에 고액을 보내면 점수가 모두 합산된다", () => {
  const result = runTransactionRiskAgent({
    amount: 30_000_000, isKnownRecipient: false, isMyAccount: false, hourOfDay: 3,
  });
  assert.equal(result.score, 35 + 20 + 15);
});
