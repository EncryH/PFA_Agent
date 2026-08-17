// /api/risk-score 핸들러.
//
// 채점 로직은 계층별 에이전트가 소유한다.
//   2층 행동 감지  → agents/behavior-detection/agent.js
//   3층 거래 검사  → agents/transaction-risk/agent.js
//   등급 산출     → agents/orchestrator.js (scoreTransferRisk)
//
// 이 파일은 dev 서버가 import 하는 진입점만 유지한다.

export { scoreTransferRisk as scoreRisk } from "./agents/orchestrator.js";
