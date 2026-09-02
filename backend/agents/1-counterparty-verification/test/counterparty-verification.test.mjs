import test from "node:test";
import assert from "node:assert/strict";

import { runCounterpartyVerificationAgent } from "../agent.js";
import { matchWhitelist } from "../rules/whitelist.js";
import { matchBlacklist } from "../rules/blacklist.js";
import { matchImpersonation } from "../rules/impersonation.js";

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

test("화이트리스트·블랙리스트 어디에도 없으면 CONTINUE 로 다음 계층에 넘긴다 — 점수는 안 준다", () => {
  const result = runCounterpartyVerificationAgent({ account: "9999999999" });
  assert.equal(result.decision, "CONTINUE");
  assert.equal(result.isKnownRecipient, false);
  // "미등록 수취인" 채점은 3층 몫이다 — 1층이 여기서 또 점수를 매기면 이중 페널티가 된다.
  assert.equal(result.score, 0);
});

test("호출자가 이미 아는 수취인이라고 알려주면 미확인 페널티 없이 CONTINUE한다", () => {
  // 프론트의 저장된 수취인 목록(KNOWN_RECIPIENTS)처럼, 공식 화이트리스트엔 없어도
  // 다른 신뢰 경로로 이미 확인된 상대는 "처음 보는 상대" 취급을 받으면 안 된다.
  const result = runCounterpartyVerificationAgent({ account: "0102345678", isKnownRecipient: true });
  assert.equal(result.decision, "CONTINUE");
  assert.equal(result.isKnownRecipient, true);
  assert.equal(result.score, 0);
  assert.deepEqual(result.reasons, []);
});

test("아직 신고 이력이 없는 신생 사칭 도메인도 이름 패턴으로 의심한다", () => {
  // 블랙리스트는 '이미 신고된 것'만 잡는다. hangyeol-secure.net 은 아직 신고 이력이 없지만
  // 한결은행 이름을 흉내낸 패턴이라 CONTINUE 로 넘기되 점수를 얹는다 — BLOCK 은 아니다
  // (진짜 관련 없는 업체일 수도 있어서 확정 판정은 하지 않는다).
  const result = runCounterpartyVerificationAgent({ domain: "hangyeol-secure.net" });
  assert.equal(result.decision, "CONTINUE");
  assert.equal(result.score, 30);
  assert.deepEqual(result.codes, ["IMPERSONATION_SUSPECTED"]);
  assert.ok(result.reasons.some((r) => r.includes("한결은행")));
});

test("공식 화이트리스트 도메인 자체는 사칭 탐지 이전에 이미 PASS로 끝난다", () => {
  const hit = matchImpersonation({ domain: "hangyeol-bank.co.kr" });
  // 이 함수 자체는 이름만 보고 판단하므로 여기선 걸리지만, agent.js 는 화이트리스트를
  // 먼저 확인하기 때문에 실제로는 이 규칙까지 도달하지 않는다(위 PASS 테스트 참고).
  assert.ok(hit);
  assert.equal(hit.brand, "한결은행");
});

test("기관 이름과 무관한 도메인은 사칭 의심을 받지 않는다", () => {
  assert.equal(matchImpersonation({ domain: "market-shop.com" }), null);
});
