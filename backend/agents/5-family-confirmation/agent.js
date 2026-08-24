import { AGENT_STATUS } from "../shared.js";

export const metadata = Object.freeze({
  layer: 5,
  key: "family-confirmation",
  name: "가족 확인·권한 위임",
  status: AGENT_STATUS.READY,
});

export const DELEGATION_LEVELS = Object.freeze({
  0: "NOTIFY_ONLY",
  1: "DELAY_AND_NOTIFY",
  2: "JOINT_CONFIRMATION",
  3: "DAMAGE_RESPONSE",
});

export const PROTECTION_POLICIES = Object.freeze({
  0: Object.freeze({ delaySeconds: 0, notifyFamily: false, allowFamilyDecision: false, guideDamageResponse: false }),
  1: Object.freeze({ delaySeconds: 300, notifyFamily: false, allowFamilyDecision: false, guideDamageResponse: false }),
  2: Object.freeze({ delaySeconds: 300, notifyFamily: true, allowFamilyDecision: true, guideDamageResponse: false }),
  3: Object.freeze({ delaySeconds: 300, notifyFamily: true, allowFamilyDecision: true, guideDamageResponse: true }),
});

/**
 * 가족에게 공유할 최소 정보와 다음 조치를 결정한다.
 * 잔액·전체 거래내역은 어떤 단계에서도 반환하지 않는다.
 */
export function runFamilyConfirmationAgent({ riskLevel = "LOW", delegatedLevel = 0, requesterVerified = false } = {}) {
  const level = Math.max(0, Math.min(3, Number(delegatedLevel) || 0));
  const policy = PROTECTION_POLICIES[level];

  if (riskLevel === "LOW") {
    return {
      agent: metadata.key,
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
    agent: metadata.key,
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
