import { metadata as maliciousApp } from "./malicious-app/agent.js";
import { metadata as counterpartyVerification } from "./counterparty-verification/agent.js";
import { metadata as behaviorDetection } from "./behavior-detection/agent.js";
import { metadata as transactionRisk } from "./transaction-risk/agent.js";
import { metadata as intentAnalysis } from "./intent-analysis/agent.js";
import { metadata as familyConfirmation } from "./family-confirmation/agent.js";
import { metadata as goldenTime } from "./golden-time/agent.js";

export const AGENT_CATALOG = Object.freeze([
  maliciousApp,
  counterpartyVerification,
  behaviorDetection,
  transactionRisk,
  intentAnalysis,
  familyConfirmation,
  goldenTime,
]);

// 방어체계의 고정 순서. 각 단계의 실행 조건은 오케스트레이터가 관리한다.
export const PIPELINE_ORDER = Object.freeze(AGENT_CATALOG.map(({ layer, key }) => ({ layer, key })));

export { runMaliciousAppAgent } from "./malicious-app/agent.js";
export { runCounterpartyVerificationAgent } from "./counterparty-verification/agent.js";
export { runBehaviorDetectionAgent } from "./behavior-detection/agent.js";
export { runTransactionRiskAgent } from "./transaction-risk/agent.js";
export { runIntentAnalysisAgent } from "./intent-analysis/agent.js";
export { runFamilyConfirmationAgent, DELEGATION_LEVELS } from "./family-confirmation/agent.js";
export { runGoldenTimeAgent } from "./golden-time/agent.js";
