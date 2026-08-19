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

/**
 * 등급 경계 — 계층별 점수를 합산한 뒤 적용하는 정책값.
 * 각 에이전트는 점수만 내고, 등급으로 바꾸는 책임은 여기에만 둔다.
 */
const GRADES = Object.freeze([
  { min: 76, grade: "D", gradeLabel: "위험", gradeColor: "danger"  },
  { min: 51, grade: "C", gradeLabel: "경계", gradeColor: "warning" },
  { min: 26, grade: "B", gradeLabel: "주의", gradeColor: "caution" },
  { min:  0, grade: "A", gradeLabel: "안전", gradeColor: "safe"    },
]);

/**
 * 2층 행동 감지 + 3층 거래 검사를 합산해 A~D 등급을 산출한다.
 *
 * 두 계층은 각자 점수와 근거만 내고, 결합과 판정은 이 함수가 담당한다.
 * 4층 의도 분석은 여기서 호출하지 않는다 — 대화가 필요하므로 별도 흐름이다.
 */
// 한도를 올린 직후 큰 금액을 보내는 조합은 배점 합산 결과에 기대지 않고 항상 최고 등급으로 강제한다.
// 가산점만으로는 다른 신호(등록된 수취인 등)와 상쇄돼 낮은 등급으로 새 나갈 수 있기 때문이다.
const LIMIT_BUMP_ESCALATION_AMOUNT = 10_000_000;
const LIMIT_BUMP_ESCALATION_REASON = "이체한도 상향 직후 고액 송금 — 최고 위험으로 강제 상향";

export function scoreTransferRisk({ behavior = {}, transaction = {} } = {}) {
  const behaviorResult = runBehaviorDetectionAgent(behavior);
  const transactionResult = runTransactionRiskAgent(transaction);

  let score = Math.min(100, behaviorResult.score + transactionResult.score);
  const reasons = [...behaviorResult.reasons, ...transactionResult.reasons];

  const limitBumps = Number(behavior.limitIncreased ?? 0);
  const amount = Number(transaction.amount ?? 0);
  if (limitBumps >= 1 && amount >= LIMIT_BUMP_ESCALATION_AMOUNT) {
    score = 100;
    reasons.push(LIMIT_BUMP_ESCALATION_REASON);
  }

  const { grade, gradeLabel, gradeColor } = GRADES.find(({ min }) => score >= min);

  return {
    score,
    grade,
    gradeLabel,
    gradeColor,
    behaviorScore: behaviorResult.score,
    transactionScore: transactionResult.score,
    reasons,
  };
}
