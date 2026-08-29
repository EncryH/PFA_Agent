// /api/risk-score 핸들러.
//
// 채점 로직은 계층별 에이전트가 소유한다.
//   1층 상대방 검증 → agents/1-counterparty-verification/agent.js
//   2층 행동 감지  → agents/2-behavior-detection/agent.js
//   3층 거래 검사  → agents/3-transaction-risk/agent.js
//   결합·등급 산출 → agents/orchestrator.js (runDefensePipeline)
//
// counterparty 필드를 안 보내는 옛 호출부도 그대로 동작한다 — 1층이 빈 입력을 받으면
// PASS/BLOCK 둘 다 안 나고 CONTINUE 로 넘어가며, 이 경우 점수를 안 보태므로(이중 페널티
// 방지 설계) 결과는 예전 2·3층 전용 채점(scoreTransferRisk)과 사실상 같다.
//
// 이 파일은 dev 서버가 import 하는 진입점만 유지한다.

export { runDefensePipeline as scoreRisk } from "./agents/orchestrator.js";
