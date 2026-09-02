import { AGENT_STATUS } from "../shared.js";
import { extractSignals, scoreSignals, SIGNALS, SIGNAL_CODES } from "./rules/signals.js";

export const metadata = Object.freeze({
  layer: 2,
  key: "behavior-detection",
  name: "행동 감지",
  status: AGENT_STATUS.READY,
});

export { SIGNALS, SIGNAL_CODES };

/**
 * 앱 안에서의 행동 시퀀스로 사기 통화 중인 상태를 감지한다.
 * 부모가 무엇을 입력하지 않아도 작동하는 것이 이 계층의 존재 이유다.
 *
 * 채점 로직 자체는 rules/signals.js 가 갖고 있다 — 이 파일은 원시 입력을 신호 코드로
 * 뽑아 채점을 위임하는 얇은 진입점이다(4층 agent.js 와 같은 구조).
 *
 * 규칙 기반이며 LLM을 쓰지 않는다. 점수만 반환하고 등급 판정은 오케스트레이터가 한다.
 */
export function runBehaviorDetectionAgent(input = {}) {
  const codes = extractSignals(input);
  const { score, reasons } = scoreSignals(codes, { historyVisits: input.historyVisits });
  return { agent: metadata.key, layer: metadata.layer, evaluated: true, score, reasons, codes };
}
