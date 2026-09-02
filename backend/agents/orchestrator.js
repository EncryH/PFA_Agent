import {
  AGENT_CATALOG,
  PIPELINE_ORDER,
  runCounterpartyVerificationAgent,
  runBehaviorDetectionAgent,
  runIntentAnalysisAgent,
  runDamageResponseAgent,
} from "./index.js";
import { evaluateTransferPrefilter } from "./3-intent-analysis/rules/transfer-prefilter.js";

const RUNNERS = Object.freeze({
  1: runCounterpartyVerificationAgent,
  2: runBehaviorDetectionAgent,
  3: runIntentAnalysisAgent,
  4: runDamageResponseAgent,
});

/**
 * 설계 순서: 1 → 2 → 3 → 4
 *
 * 1은 상대방, 2는 앱 행동, 3은 현재 거래의 빠른 신호와 이전 거래 패턴,
 * 대화 의도를 함께 분석한다. 4는 이미 송금했거나 정보가 노출된 피해 상황에서 시작한다.
 * 가족 확인·권한 위임은 순차 에이전트가 아니라 features/family-protection의 선택 기능이다.
 */
export function getPipelineArchitecture() {
  return PIPELINE_ORDER.map((stage) => ({
    ...stage,
    ...AGENT_CATALOG.find(({ layer }) => layer === stage.layer),
  }));
}

/** 단일 방어 단계를 실행한다. */
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
 * 2단계 행동 감지와 3단계 내부의 빠른 거래 신호를 합산해 사전 등급을 산출한다.
 *
 * 빠른 거래 신호는 독립 에이전트가 아니라 의도분석 진입 여부를 정하는 내부 필터다.
 * Supabase 이전 거래 패턴과 대화 기반 최종 판정은 3단계 대화 흐름에서 수행한다.
 */
// 한도를 올린 직후 큰 금액을 보내는 조합은 배점 합산 결과에 기대지 않고 항상 최고 등급으로 강제한다.
// 가산점만으로는 다른 신호(등록된 수취인 등)와 상쇄돼 낮은 등급으로 새 나갈 수 있기 때문이다.
const LIMIT_BUMP_ESCALATION_AMOUNT = 10_000_000;
const LIMIT_BUMP_ESCALATION_REASON = "이체한도 상향 직후 고액 송금 — 최고 위험으로 강제 상향";

export function scoreTransferRisk({ behavior = {}, transaction = {} } = {}) {
  const behaviorResult = runBehaviorDetectionAgent(behavior);
  const transferSignalResult = evaluateTransferPrefilter(transaction);

  let score = Math.min(100, behaviorResult.score + transferSignalResult.score);
  const reasons = [...behaviorResult.reasons, ...transferSignalResult.reasons];

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
    transferSignalScore: transferSignalResult.score,
    reasons,
  };
}
