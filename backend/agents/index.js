import { metadata as maliciousApp } from "./0-malicious-app/agent.js";
import { metadata as counterpartyVerification } from "./1-counterparty-verification/agent.js";
import { metadata as behaviorDetection } from "./2-behavior-detection/agent.js";
import { metadata as transactionRisk } from "./3-transaction-risk/agent.js";
import { metadata as intentAnalysis } from "./4-intent-analysis/agent.js";
import { metadata as familyConfirmation } from "./5-family-confirmation/agent.js";
import { metadata as goldenTime } from "./6-golden-time/agent.js";

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

export { runMaliciousAppAgent } from "./0-malicious-app/agent.js";
export { runCounterpartyVerificationAgent } from "./1-counterparty-verification/agent.js";
export { runBehaviorDetectionAgent } from "./2-behavior-detection/agent.js";
export { runTransactionRiskAgent } from "./3-transaction-risk/agent.js";
export { runIntentAnalysisAgent } from "./4-intent-analysis/agent.js";
export { runFamilyConfirmationAgent, DELEGATION_LEVELS, PROTECTION_POLICIES } from "./5-family-confirmation/agent.js";
export { runGoldenTimeAgent } from "./6-golden-time/agent.js";
