import test from "node:test";
import assert from "node:assert/strict";

import { runCounterpartyVerificationAgent } from "../agent.js";
import { matchWhitelist } from "../rules/whitelist.js";
import { matchBlacklist } from "../rules/blacklist.js";

test("공식 은행 대표번호는 화이트리스트로 즉시 통과시킨다", () => {
  const result = runCounterpartyVerificationAgent({ phone: "1588-5000" });
  assert.equal(result.decision, "PASS");
  assert.equal(result.score, 0);
  assert.equal(result.isKnownRecipient, true);
});

test("사칭 도메인이 공식 도메인 문자열을 포함해도 화이트리스트로 새지 않는다", () => {
  // kb-safe.com 은 실제 은행 도메인이 아니다 — 이름에 은행명이 들어있다고 안전 판정하면 안 된다.
  const hit = matchWhitelist({ domain: "kb-safe.com" });
  assert.equal(hit, null);
});

test("공식 도메인의 서브도메인은 화이트리스트로 통과한다", () => {
  const hit = matchWhitelist({ domain: "www.fss.or.kr" });
  assert.ok(hit);
  assert.equal(hit.name, "금융감독원");
});

test("더치트 신고 이력이 있는 계좌는 즉시 차단한다", () => {
  const result = runCounterpartyVerificationAgent({ account: "1104421783" });
  assert.equal(result.decision, "BLOCK");
  assert.equal(result.score, 100);
  assert.ok(result.reasons[0].includes("더치트"));
});

test("사칭 도메인은 부분 일치로도 블랙리스트에 걸린다", () => {
  const hit = matchBlacklist("http://mail.kb-safe.com/login");
  assert.ok(hit);
  assert.equal(hit.matchedKey, "kb-safe.com");
});

test("짧은 숫자는 계좌번호 오탐을 막기 위해 블랙리스트 매칭에서 제외한다", () => {
  assert.equal(matchBlacklist("112"), null);
});

test("화이트리스트·블랙리스트 어디에도 없으면 CONTINUE 로 다음 계층에 넘긴다", () => {
  const result = runCounterpartyVerificationAgent({ account: "9999999999" });
  assert.equal(result.decision, "CONTINUE");
  assert.equal(result.isKnownRecipient, false);
  assert.ok(result.score > 0);
});
