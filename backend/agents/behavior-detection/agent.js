import { AGENT_STATUS, pendingAgentResult } from "../shared.js";

export const metadata = Object.freeze({
  layer: 2,
  key: "behavior-detection",
  name: "행동 감지",
  status: AGENT_STATUS.TEAM_IMPLEMENTATION,
});

export async function runBehaviorDetectionAgent() {
  return pendingAgentResult(metadata.key, metadata.status, "앱 행동 시퀀스 탐지 구현 예정");
}
