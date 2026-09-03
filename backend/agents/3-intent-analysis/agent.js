import { handleIntent } from "./intent.js";
import { AGENT_STATUS } from "../shared.js";
import { routeIntentRequest } from "./middleware/index.js";
import { guardIntentResult } from "./middleware/output-guard.js";

export const metadata = Object.freeze({
  layer: 3,
  key: "intent-analysis",
  name: "AI 송금 의도 분석",
  status: AGENT_STATUS.READY,
});

// LLM은 의도와 위험 신호를 추출하고, 같은 폴더의 규칙 엔진이 점수와 보류 여부를 결정한다.
export async function runIntentAnalysisAgent(input, { apiKey, graphConfig, databaseConfig } = {}) {
  const routed = await routeIntentRequest(input, { apiKey });
  if (routed.handled) return routed.response;

  const result = await handleIntent(routed.input, apiKey, { graphConfig, databaseConfig, middleware: routed.middleware || {} });
  return guardIntentResult({
    ...result,
    middleware: routed.middleware,
  });
}
