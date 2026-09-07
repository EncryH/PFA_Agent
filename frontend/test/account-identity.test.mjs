import test from "node:test";
import assert from "node:assert/strict";
import { isMyAccount, lookupHolder, runIntentPrefilter, validateTransferAmount } from "../src/shared/data.ts";

test("only complete own account numbers bypass review", () => {
  assert.equal(isMyAccount("110-1234-567"), true);
  for (const account of ["11012345", "1101234599", "991101234567", "110123456799"]) {
    assert.equal(isMyAccount(account), false, account);
    assert.equal(runIntentPrefilter(account, 3_000_000, "본인"), "ai-chat", account);
  }
});

test("recipient names and shared prefixes are not identity evidence", () => {
  assert.equal(lookupHolder("010-2345-678"), "딸 지혜");
  assert.notEqual(lookupHolder("0102345699"), "딸 지혜");
  assert.equal(runIntentPrefilter("0102345699", 500_000, "딸 지혜"), "ai-chat");
  assert.equal(runIntentPrefilter("9999999999", 500_000, "딸 지혜"), "ai-chat");
  assert.equal(runIntentPrefilter("0102345678", 500_000, "딸 지혜"), "success");
});

test("only an exact reported account match triggers the blacklist warning", () => {
  assert.equal(runIntentPrefilter("1104421783", 10_000, "미확인"), "db-warning");
  assert.equal(runIntentPrefilter("1104421999", 10_000, "미확인"), "success");
  assert.equal(runIntentPrefilter("110442178399", 10_000, "미확인"), "success");
});

test("transfer amounts cannot overdraw or exceed the remaining daily limit", () => {
  assert.equal(validateTransferAmount(1000, 1000, 1000), null);
  assert.equal(validateTransferAmount(1001, 1000, 5000), "insufficient_funds");
  assert.equal(validateTransferAmount(1000, 5000, 999), "daily_limit");
  assert.equal(validateTransferAmount(1, 0, 5000), "insufficient_funds");
  assert.equal(validateTransferAmount(1000, 1000, Infinity), null);
  for (const amount of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(validateTransferAmount(amount, 5000, 5000), "invalid_amount");
  }
});
