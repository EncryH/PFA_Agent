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

/**
 * 0~3층 방어선을 순서대로 실행한다. README 아키텍처의 "0~3은 기본 방어선이다.
 * 거래 위험이 없으면 여기서 정상 송금으로 종료한다"를 코드로 그대로 옮긴 것.
 *
 * 1층(상대방 검증)에서 결론이 분명하면(PASS/BLOCK) 거기서 즉시 끝내고 2·3층은 부르지 않는다.
 * 결론이 안 나면(CONTINUE) 1층 점수까지 포함해 2·3층과 합산해서 등급을 낸다 — 이때 1층이
 * "본 적 없는 상대"라고 판단한 것을 3층의 isKnownRecipient 로도 넘겨서 이중 입력을 없앤다.
 *
 * 4층(의도 분석)은 대화가 필요해 여기서 호출하지 않는다 — scoreTransferRisk 와 동일한 제약.
 */
export function runDefensePipeline({ counterparty = {}, behavior = {}, transaction = {} } = {}) {
  // 프론트가 저장된 수취인 목록 등으로 이미 아는 상대라고 표시했으면(counterparty.isKnownRecipient
  // 또는 기존 transaction.isKnownRecipient 둘 다 받아준다) 1층도 그 사실을 그대로 인정한다 —
  // 공식 화이트리스트에 없다는 이유만으로 "미확인 상대" 취급해 3층과 이중 페널티를 주지 않기 위해서다.
  const counterpartyResult = runCounterpartyVerificationAgent({
    ...counterparty,
    isKnownRecipient: Boolean(counterparty.isKnownRecipient) || Boolean(transaction.isKnownRecipient),
  });

  if (counterpartyResult.decision === "PASS" || counterpartyResult.decision === "BLOCK") {
    const score = counterpartyResult.decision === "PASS" ? 0 : 100;
    const { grade, gradeLabel, gradeColor } = GRADES.find(({ min }) => score >= min);
    return {
      score,
      grade,
      gradeLabel,
      gradeColor,
      counterpartyScore: counterpartyResult.score,
      behaviorScore: 0,
      transactionScore: 0,
      reasons: counterpartyResult.reasons,
      stoppedAt: counterpartyResult.agent,
      thecheat: counterpartyResult.thecheat,
    };
  }

  const behaviorResult = runBehaviorDetectionAgent(behavior);
  const transactionResult = runTransactionRiskAgent({
    ...transaction,
    isKnownRecipient: Boolean(transaction.isKnownRecipient) || counterpartyResult.isKnownRecipient,
  });

  let score = Math.min(
    100,
    counterpartyResult.score + behaviorResult.score + transactionResult.score,
  );
  const reasons = [...counterpartyResult.reasons, ...behaviorResult.reasons, ...transactionResult.reasons];

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
    counterpartyScore: counterpartyResult.score,
    behaviorScore: behaviorResult.score,
    transactionScore: transactionResult.score,
    reasons,
  };
}
