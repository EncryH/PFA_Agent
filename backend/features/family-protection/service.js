// 이 파일의 evaluateFamilyProtection은 채점 로직만 구현돼 있고 어떤 /api 라우트에도 연결돼
// 있지 않다 — 프론트(shared/protection.ts)가 같은 정책 JSON을 직접 읽어 동일한 판단을
// 클라이언트에서 내리므로 왕복 호출이 필요 없기 때문이다. 유닛 테스트로만 검증한다.
import familyProtectionConfig from "../../../shared/family-protection-policy.json" with { type: "json" };

export const feature = Object.freeze({ ...familyProtectionConfig.feature });

export const DELEGATION_LEVELS = Object.freeze(Object.fromEntries(
  familyProtectionConfig.levels.map(({ level, code }) => [level, code]),
));

export const PROTECTION_POLICIES = Object.freeze(Object.fromEntries(
  familyProtectionConfig.levels.map(({ level, policy }) => [level, Object.freeze({ ...policy })]),
));

/**
 * 가족에게 공유할 최소 정보와 다음 조치를 결정한다.
 * 잔액·전체 거래내역은 어떤 단계에서도 반환하지 않는다.
 */
export function evaluateFamilyProtection({ riskLevel = "LOW", delegatedLevel = 0, requesterVerified = false } = {}) {
  const level = Math.max(0, Math.min(3, Number(delegatedLevel) || 0));
  const policy = PROTECTION_POLICIES[level];

  if (riskLevel === "LOW") {
    return {
      feature: feature.key,
      decision: "PASS",
      level,
      notifyFamily: false,
      delaySeconds: 0,
      allowFamilyDecision: false,
      guideDamageResponse: false,
    };
  }

  const highRisk = riskLevel === "HIGH" || riskLevel === "CRITICAL";
  const decision = !highRisk
    ? "RECONFIRM"
    : policy.allowFamilyDecision
      ? "REQUEST_JOINT_CONFIRMATION"
      : policy.delaySeconds > 0
        ? "DELAY_AND_RECONFIRM"
        : "WARN_PARENT";

  return {
    feature: feature.key,
    decision,
    level,
    notifyFamily: highRisk && policy.notifyFamily,
    delaySeconds: highRisk ? policy.delaySeconds : 0,
    allowFamilyDecision: highRisk && policy.allowFamilyDecision,
    guideDamageResponse: highRisk && policy.guideDamageResponse,
    requesterVerificationRequired: highRisk && policy.allowFamilyDecision && !requesterVerified,
    sharedFields: highRisk && policy.notifyFamily
      ? ["riskLevel", "riskReasons", "amount", "recipientType", "requestedAt"]
      : [],
    excludedFields: ["balance", "fullTransactionHistory", "accountCredentials"],
  };
}
