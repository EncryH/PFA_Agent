import { AGENT_STATUS, pendingAgentResult } from "../shared.js";

export const metadata = Object.freeze({
  layer: 0,
  key: "malicious-app",
  name: "악성 앱 탐지",
  status: AGENT_STATUS.EXTERNAL_INTEGRATION,
});

// MVP에서는 은행의 기존 악성 앱 탐지 결과를 받아오는 연동 지점만 둔다.
export async function runMaliciousAppAgent() {
  return pendingAgentResult(metadata.key, metadata.status, "은행 기존 탐지 시스템 연동 대상");
}
