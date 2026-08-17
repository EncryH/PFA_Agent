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

/**
 * 가족에게 공유할 최소 정보와 다음 조치를 결정한다.
 * 잔액·전체 거래내역은 어떤 단계에서도 반환하지 않는다.
 */
export function runFamilyConfirmationAgent({ riskLevel = "LOW", delegatedLevel = 0, requesterVerified = false } = {}) {
  const level = Math.max(0, Math.min(3, Number(delegatedLevel) || 0));

  if (riskLevel === "LOW") {
    return { agent: metadata.key, decision: "PASS", level, notifyFamily: false, delaySeconds: 0 };
  }

  const highRisk = riskLevel === "HIGH" || riskLevel === "CRITICAL";
  return {
    agent: metadata.key,
    decision: highRisk ? (level >= 2 ? "REQUEST_JOINT_CONFIRMATION" : "ASK_PARENT_AGAIN") : "RECONFIRM",
    level,
    notifyFamily: level >= 0,
    delaySeconds: highRisk && level >= 1 ? 300 : 0,
    requesterVerificationRequired: highRisk && !requesterVerified,
    sharedFields: ["riskLevel", "riskReasons", "amount", "recipientType", "requestedAt"],
    excludedFields: ["balance", "fullTransactionHistory", "accountCredentials"],
  };
}
