// /api/risk-score 핸들러.
//
// 채점 로직은 2단계 행동 에이전트와 3단계 내부 사전 필터가 소유한다.
//   2층 행동 감지  → agents/2-behavior-detection/agent.js
//   3단계 송금 신호 → agents/3-intent-analysis/rules/transfer-prefilter.js
//   사전 등급 산출  → agents/orchestrator.js (scoreTransferRisk)
//
// 이 파일은 dev 서버가 import 하는 진입점만 유지한다.

export { scoreTransferRisk as scoreRisk } from "./agents/orchestrator.js";
