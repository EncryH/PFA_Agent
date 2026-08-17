import { AGENT_STATUS, pendingAgentResult } from "../shared.js";

export const metadata = Object.freeze({
  layer: 3,
  key: "transaction-risk",
  name: "거래 검사",
  status: AGENT_STATUS.TEAM_IMPLEMENTATION,
});

export async function runTransactionRiskAgent() {
  return pendingAgentResult(metadata.key, metadata.status, "거래 패턴 점수 계산 구현 예정");
}
