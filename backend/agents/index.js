import { metadata as counterpartyVerification } from "./1-counterparty-verification/agent.js";
import { metadata as behaviorDetection } from "./2-behavior-detection/agent.js";
import { metadata as intentAnalysis } from "./3-intent-analysis/agent.js";
import { metadata as damageResponse } from "./4-damage-response/agent.js";

export const AGENT_CATALOG = Object.freeze([
  counterpartyVerification,
  behaviorDetection,
  intentAnalysis,
  damageResponse,
]);

// 방어체계의 고정 순서. 각 단계의 실행 조건은 오케스트레이터가 관리한다.
export const PIPELINE_ORDER = Object.freeze(AGENT_CATALOG.map(({ layer, key }) => ({ layer, key })));

export { runCounterpartyVerificationAgent } from "./1-counterparty-verification/agent.js";
export { runBehaviorDetectionAgent } from "./2-behavior-detection/agent.js";
export { runIntentAnalysisAgent } from "./3-intent-analysis/agent.js";
export { runDamageResponseAgent } from "./4-damage-response/agent.js";
