import test from "node:test";
import assert from "node:assert/strict";

import familyProtectionConfig from "../../../shared/family-protection-policy.json" with { type: "json" };
import { DELEGATION_LEVELS, PROTECTION_POLICIES, evaluateFamilyProtection } from "./service.js";

test("프론트와 백엔드가 사용하는 가족 보호 정책은 공통 설정에서 파생된다", () => {
  for (const item of familyProtectionConfig.levels) {
    assert.equal(DELEGATION_LEVELS[item.level], item.code);
    assert.deepEqual(PROTECTION_POLICIES[item.level], item.policy);
  }
});

test("보호 단계별 고위험 권한이 누적 적용된다", () => {
  const level0 = evaluateFamilyProtection({ riskLevel: "HIGH", delegatedLevel: 0 });
  assert.equal(level0.decision, "WARN_PARENT");
  assert.equal(level0.delaySeconds, 0);
  assert.equal(level0.notifyFamily, false);
  assert.equal(level0.allowFamilyDecision, false);

  const level1 = evaluateFamilyProtection({ riskLevel: "HIGH", delegatedLevel: 1 });
  assert.equal(level1.decision, "DELAY_AND_RECONFIRM");
  assert.equal(level1.delaySeconds, 300);
  assert.equal(level1.notifyFamily, false);

  const level2 = evaluateFamilyProtection({ riskLevel: "HIGH", delegatedLevel: 2 });
  assert.equal(level2.decision, "REQUEST_JOINT_CONFIRMATION");
  assert.equal(level2.delaySeconds, 300);
  assert.equal(level2.notifyFamily, true);
  assert.equal(level2.allowFamilyDecision, true);
  assert.equal(level2.guideDamageResponse, false);

  const level3 = evaluateFamilyProtection({ riskLevel: "CRITICAL", delegatedLevel: 3 });
  assert.equal(level3.decision, "REQUEST_JOINT_CONFIRMATION");
  assert.equal(level3.delaySeconds, 300);
  assert.equal(level3.allowFamilyDecision, true);
  assert.equal(level3.guideDamageResponse, true);
});

test("저위험 거래는 보호 단계와 무관하게 가족에게 공유하지 않는다", () => {
  const result = evaluateFamilyProtection({ riskLevel: "LOW", delegatedLevel: 3 });
  assert.equal(result.decision, "PASS");
  assert.equal(result.notifyFamily, false);
  assert.equal(result.delaySeconds, 0);
  assert.equal(result.allowFamilyDecision, false);
});
