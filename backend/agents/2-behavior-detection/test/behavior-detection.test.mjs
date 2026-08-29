import test from "node:test";
import assert from "node:assert/strict";

import { runBehaviorDetectionAgent } from "../agent.js";

test("아무 신호도 없으면 상대방 검증 미실시 감점만 붙는다", () => {
  const result = runBehaviorDetectionAgent({ verifyVisited: true });
  assert.equal(result.score, 0);
  assert.deepEqual(result.reasons, []);
});

test("상대방 검증을 안 하면 8점이 붙는다", () => {
  const result = runBehaviorDetectionAgent({});
  assert.equal(result.score, 8);
});

test("적금 1회 중도해지는 55점 — 단독으로 C등급 문턱(51점)을 넘는다", () => {
  const result = runBehaviorDetectionAgent({ savingsEarlyClose: 1, verifyVisited: true });
  assert.equal(result.score, 55);
});

test("적금 2회 이상 중도해지는 80점으로 더 무겁게 본다", () => {
  const result = runBehaviorDetectionAgent({ savingsEarlyClose: 2, verifyVisited: true });
  assert.equal(result.score, 80);
});

test("이체한도 상향 직후는 55점 — B등급(원터치 통과)으로 새지 않게 문턱을 넘긴다", () => {
  const result = runBehaviorDetectionAgent({ limitIncreased: 1, verifyVisited: true });
  assert.equal(result.score, 55);
  assert.ok(result.reasons.some((r) => r.includes("한도")));
});

test("잔액 3회 이상 반복 조회는 28점", () => {
  const result = runBehaviorDetectionAgent({ historyVisits: 3, verifyVisited: true });
  assert.equal(result.score, 28);
});

test("15초 미만 초고속 이체는 18점이 추가된다", () => {
  const result = runBehaviorDetectionAgent({ verifyVisited: true, sessionSeconds: 5 });
  assert.equal(result.score, 18);
});

test("여러 신호는 합산된다 — 한도상향 + 반복조회 + 빠른 이체", () => {
  const result = runBehaviorDetectionAgent({
    limitIncreased: 1, historyVisits: 3, verifyVisited: true, sessionSeconds: 10,
  });
  assert.equal(result.score, 55 + 28 + 18);
});
