import { AGENT_STATUS } from "../shared.js";
import { extractSignals, scoreSignals, SIGNALS, SIGNAL_CODES } from "./rules/signals.js";

export const metadata = Object.freeze({
  layer: 3,
  key: "transaction-risk",
  name: "거래 검사",
  status: AGENT_STATUS.READY,
});

export { SIGNALS, SIGNAL_CODES };

/**
 * 이 거래가 평소와 다른지만 본다. 송금 이유는 4층이 다룬다.
 *
 * 채점 로직 자체는 rules/signals.js 가 갖고 있다 — 이 파일은 원시 입력을 신호 코드로
 * 뽑아 채점을 위임하는 얇은 진입점이다(2·4층 agent.js 와 같은 구조).
 *
 * 0점이면 이후 계층을 실행하지 않는다 — 정상 거래의 무마찰을 보장하는 지점이다.
 * 점수만 반환하고 등급 판정은 오케스트레이터가 한다.
 */
export function runTransactionRiskAgent(input = {}) {
  const codes = extractSignals(input);
  const { score, reasons } = scoreSignals(codes);
  return { agent: metadata.key, layer: metadata.layer, evaluated: true, score, reasons, codes };
}
