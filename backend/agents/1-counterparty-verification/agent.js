import { AGENT_STATUS, pendingAgentResult } from "../shared.js";

export const metadata = Object.freeze({
  layer: 1,
  key: "counterparty-verification",
  name: "상대방 검증",
  status: AGENT_STATUS.TEAM_IMPLEMENTATION,
});

export async function runCounterpartyVerificationAgent() {
  return pendingAgentResult(metadata.key, metadata.status, "공식 번호·도메인 화이트리스트 검증 구현 예정");
}
