export const AGENT_STATUS = Object.freeze({
  READY: "READY",
  TEAM_IMPLEMENTATION: "TEAM_IMPLEMENTATION",
  EXTERNAL_INTEGRATION: "EXTERNAL_INTEGRATION",
});

export function pendingAgentResult(agent, status, message) {
  return {
    agent,
    status,
    evaluated: false,
    signals: [],
    message,
  };
}
