import { readFileSync } from "node:fs";

import { executeNeo4jQuery, resolveNeo4jConfig } from "../retrieval/neo4j-client.js";

const graphUrl = new URL("../datasets/rag/cases/fraud-knowledge-graph.json", import.meta.url);
const graph = JSON.parse(readFileSync(graphUrl, "utf8"));
const resolvedConfig = resolveNeo4jConfig();
const config = {
  ...resolvedConfig,
  // 초기 적재는 실시간 검색보다 오래 걸릴 수 있으므로 별도 여유를 둔다.
  timeoutMs: Math.max(resolvedConfig.timeoutMs, 10_000),
};

if (!config.enabled) {
  console.error("AuraDB 연결값이 없습니다. 루트 .env에 NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD를 설정하세요.");
  process.exitCode = 1;
} else {
  await seed();
}

function distinctByCode(items) {
  return [...new Map(items.filter(Boolean).map((item) => [item.code, item])).values()];
}

async function run(statement, parameters = {}) {
  return executeNeo4jQuery(statement, parameters, config, { bypassCircuitBreaker: true });
}

async function seed() {
  const types = graph.fraud_types || [];
  const signals = distinctByCode(types.flatMap((type) => type.signals));
  const channels = distinctByCode(types.flatMap((type) => type.channels));
  const impersonators = distinctByCode(types.flatMap((type) => type.impersonators));
  const requestedActions = distinctByCode(types.flatMap((type) => type.requested_actions));
  const attackStages = distinctByCode(types.flatMap((type) => type.steps.map((step) => ({
    code: step.stage,
    label: step.stage_label,
  }))));
  const steps = types.flatMap((type) => type.steps.map((step) => ({
    id: `${type.code}:${step.order}`,
    fraudTypeCode: type.code,
    order: step.order,
    label: step.label,
    stageCode: step.stage,
  })));
  const safetyActions = types.flatMap((type) => type.safety_actions.map((action) => ({
    id: `${type.code}:${action.order}`,
    fraudTypeCode: type.code,
    order: action.order,
    label: action.label,
  })));

  const constraints = [
    ["fraud_type_code", "FraudType"],
    ["risk_signal_code", "RiskSignal"],
    ["channel_code", "Channel"],
    ["impersonator_code", "Impersonator"],
    ["requested_action_code", "RequestedAction"],
    ["attack_stage_code", "AttackStage"],
  ];
  for (const [name, label] of constraints) {
    await run(`CREATE CONSTRAINT ${name} IF NOT EXISTS FOR (n:${label}) REQUIRE n.code IS UNIQUE`);
  }
  await run("CREATE CONSTRAINT attack_step_id IF NOT EXISTS FOR (n:AttackStep) REQUIRE n.id IS UNIQUE");
  await run("CREATE CONSTRAINT safety_action_id IF NOT EXISTS FOR (n:SafetyAction) REQUIRE n.id IS UNIQUE");

  await run(`UNWIND $rows AS row MERGE (n:FraudType {code: row.code}) SET n.label = row.label, n.summary = row.summary, n.schema_version = $version`, {
    rows: types.map(({ code, label, summary }) => ({ code, label, summary })),
    version: graph.schema_version,
  });
  await run("UNWIND $rows AS row MERGE (n:RiskSignal {code: row.code}) SET n.label = row.label", { rows: signals });
  await run("UNWIND $rows AS row MERGE (n:Channel {code: row.code}) SET n.label = row.label", { rows: channels });
  await run("UNWIND $rows AS row MERGE (n:Impersonator {code: row.code}) SET n.label = row.label", { rows: impersonators });
  await run("UNWIND $rows AS row MERGE (n:RequestedAction {code: row.code}) SET n.label = row.label", { rows: requestedActions });
  await run("UNWIND $rows AS row MERGE (n:AttackStage {code: row.code}) SET n.label = row.label", { rows: attackStages });
  await run("UNWIND $rows AS row MERGE (n:AttackStep {id: row.id}) SET n.order = row.order, n.label = row.label", { rows: steps });
  await run("UNWIND $rows AS row MERGE (n:SafetyAction {id: row.id}) SET n.order = row.order, n.label = row.label", { rows: safetyActions });

  await run(`UNWIND $rows AS row MATCH (f:FraudType {code: row.fraudTypeCode}) MATCH (s:RiskSignal {code: row.code}) MERGE (f)-[r:HAS_SIGNAL]->(s) SET r.weight = row.weight`, {
    rows: types.flatMap((type) => type.signals.map((item) => ({ ...item, fraudTypeCode: type.code }))),
  });
  await run("UNWIND $rows AS row MATCH (f:FraudType {code: row.fraudTypeCode}) MATCH (n:Channel {code: row.code}) MERGE (f)-[:USES_CHANNEL]->(n)", {
    rows: types.flatMap((type) => type.channels.map((item) => ({ ...item, fraudTypeCode: type.code }))),
  });
  await run("UNWIND $rows AS row MATCH (f:FraudType {code: row.fraudTypeCode}) MATCH (n:Impersonator {code: row.code}) MERGE (f)-[:IMPERSONATES]->(n)", {
    rows: types.flatMap((type) => type.impersonators.map((item) => ({ ...item, fraudTypeCode: type.code }))),
  });
  await run("UNWIND $rows AS row MATCH (f:FraudType {code: row.fraudTypeCode}) MATCH (n:RequestedAction {code: row.code}) MERGE (f)-[:REQUESTS]->(n)", {
    rows: types.flatMap((type) => type.requested_actions.map((item) => ({ ...item, fraudTypeCode: type.code }))),
  });
  await run("UNWIND $rows AS row MATCH (f:FraudType {code: row.fraudTypeCode}) MATCH (step:AttackStep {id: row.id}) MATCH (stage:AttackStage {code: row.stageCode}) MERGE (f)-[:HAS_STEP]->(step) MERGE (step)-[:AT_STAGE]->(stage)", { rows: steps });
  await run("UNWIND $rows AS row MATCH (f:FraudType {code: row.fraudTypeCode}) MATCH (action:SafetyAction {id: row.id}) MERGE (f)-[:RECOMMENDS]->(action)", { rows: safetyActions });
  await run("UNWIND $rows AS row MATCH (from:AttackStep {id: row.from}) MATCH (to:AttackStep {id: row.to}) MERGE (from)-[:NEXT_STEP]->(to)", {
    rows: types.flatMap((type) => type.steps.slice(0, -1).map((step, index) => ({
      from: `${type.code}:${step.order}`,
      to: `${type.code}:${type.steps[index + 1].order}`,
    }))),
  });

  const counts = await run("MATCH (n) RETURN labels(n)[0] AS label, count(n) AS count ORDER BY label");
  console.log(`Neo4j 지식그래프 적재 완료 (schema ${graph.schema_version})`);
  for (const item of counts) console.log(`- ${item.label}: ${item.count}`);
}
