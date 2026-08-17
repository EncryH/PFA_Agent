import {
  AGENT_CATALOG,
  PIPELINE_ORDER,
  runMaliciousAppAgent,
  runCounterpartyVerificationAgent,
  runBehaviorDetectionAgent,
  runTransactionRiskAgent,
  runIntentAnalysisAgent,
  runFamilyConfirmationAgent,
  runGoldenTimeAgent,
} from "./index.js";

const RUNNERS = Object.freeze({
  0: runMaliciousAppAgent,
  1: runCounterpartyVerificationAgent,
  2: runBehaviorDetectionAgent,
  3: runTransactionRiskAgent,
  4: runIntentAnalysisAgent,
  5: runFamilyConfirmationAgent,
  6: runGoldenTimeAgent,
});

/**
 * 설계 순서: 0 → 1 → 2 → 3 → 4 → 5 → 6
 *
 * 0~3은 기본 방어선이다. 거래 위험이 없으면 여기서 정상 송금으로 종료한다.
 * 위험 신호가 있으면 4(의도 분석), 고위험이면 5(가족 확인)로 진행한다.
 * 6은 송금이 이미 실행된 피해 상황에서만 시작한다.
 * 미구현 단계는 자동으로 건너뛰지 않는다. 전체 실행 연결은 1~3 구현 후 추가한다.
 */
export function getPipelineArchitecture() {
  return PIPELINE_ORDER.map((stage) => ({
    ...stage,
    ...AGENT_CATALOG.find(({ layer }) => layer === stage.layer),
  }));
}

/** 단일 방어 단계를 실행한다. 전체 자동 실행은 1~3단계 구현 후 연결한다. */
export async function runAgentLayer(layer, input = {}, dependencies = {}) {
  const runner = RUNNERS[layer];
  if (!runner) throw new Error(`지원하지 않는 안심동행 단계입니다: ${layer}`);
  return runner(input, dependencies);
}
