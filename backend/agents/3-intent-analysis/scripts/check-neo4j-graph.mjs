import { readFileSync } from "node:fs";

import {
  executeNeo4jQuery,
  resolveNeo4jConfig,
} from "../retrieval/neo4j-client.js";

const graphUrl = new URL("../datasets/rag/cases/fraud-knowledge-graph.json", import.meta.url);
const graph = JSON.parse(readFileSync(graphUrl, "utf8"));
const resolved = resolveNeo4jConfig();
const config = { ...resolved, timeoutMs: Math.max(resolved.timeoutMs, 5_000) };

if (!config.enabled) {
  console.error("AuraDB 연결값이 없습니다.");
  process.exitCode = 1;
} else {
  await verify();
}

function uniqueCount(items) {
  return new Set(items.filter(Boolean)).size;
}

function mapRows(rows, key, value) {
  return Object.fromEntries(rows.map((row) => [row[key], Number(row[value])]));
}

async function query(statement, parameters = {}) {
  return executeNeo4jQuery(statement, parameters, config, { bypassCircuitBreaker: true });
}

async function verify() {
  const types = graph.fraud_types || [];
  const expectedNodes = {
    FraudType: types.length,
    RiskSignal: uniqueCount(types.flatMap((type) => type.signals.map((item) => item.code))),
    Channel: uniqueCount(types.flatMap((type) => type.channels.map((item) => item.code))),
    Impersonator: uniqueCount(types.flatMap((type) => type.impersonators.map((item) => item.code))),
    RequestedAction: uniqueCount(types.flatMap((type) => type.requested_actions.map((item) => item.code))),
    AttackStage: uniqueCount(types.flatMap((type) => type.steps.map((item) => item.stage))),
    AttackStep: types.reduce((total, type) => total + type.steps.length, 0),
    SafetyAction: types.reduce((total, type) => total + type.safety_actions.length, 0),
  };
  const expectedRelationships = {
    HAS_SIGNAL: types.reduce((total, type) => total + type.signals.length, 0),
    USES_CHANNEL: types.reduce((total, type) => total + type.channels.length, 0),
    IMPERSONATES: types.reduce((total, type) => total + type.impersonators.length, 0),
    REQUESTS: types.reduce((total, type) => total + type.requested_actions.length, 0),
    HAS_STEP: expectedNodes.AttackStep,
    AT_STAGE: expectedNodes.AttackStep,
    RECOMMENDS: expectedNodes.SafetyAction,
    NEXT_STEP: types.reduce((total, type) => total + Math.max(0, type.steps.length - 1), 0),
  };

  const nodeRows = await query("MATCH (n) RETURN labels(n)[0] AS label, count(n) AS count ORDER BY label");
  const relationshipRows = await query("MATCH ()-[r]->() RETURN type(r) AS type, count(r) AS count ORDER BY type");
  const actualNodes = mapRows(nodeRows, "label", "count");
  const actualRelationships = mapRows(relationshipRows, "type", "count");

  const mismatches = [];
  for (const [label, expected] of Object.entries(expectedNodes)) {
    if ((actualNodes[label] || 0) !== expected) {
      mismatches.push(`노드 ${label}: expected=${expected}, actual=${actualNodes[label] || 0}`);
    }
  }
  for (const [type, expected] of Object.entries(expectedRelationships)) {
    if ((actualRelationships[type] || 0) !== expected) {
      mismatches.push(`관계 ${type}: expected=${expected}, actual=${actualRelationships[type] || 0}`);
    }
  }

  const pathRows = await query(`
    MATCH (f:FraudType {code: $code})-[:HAS_STEP]->(step:AttackStep)
    OPTIONAL MATCH (step)-[:AT_STAGE]->(stage:AttackStage)
    RETURN f.label AS fraudType, step.order AS stepOrder,
      step.label AS stepLabel, stage.label AS stageLabel
    ORDER BY step.order
  `, { code: "institution_impersonation" });

  console.log("AuraDB 지식그래프 검증 결과");
  console.log(`- schema: ${graph.schema_version}`);
  console.log(`- nodes: ${Object.values(actualNodes).reduce((sum, count) => sum + count, 0)}`);
  console.log(`- relationships: ${Object.values(actualRelationships).reduce((sum, count) => sum + count, 0)}`);
  for (const [label, count] of Object.entries(actualNodes).sort()) {
    console.log(`  - ${label}: ${count}`);
  }
  console.log("- 관계 유형:");
  for (const [type, count] of Object.entries(actualRelationships).sort()) {
    console.log(`  - ${type}: ${count}`);
  }
  console.log(`- 기관사칭 경로: ${pathRows.map((row) => row.stepLabel).join(" → ")}`);

  if (mismatches.length || pathRows.length !== 4) {
    for (const mismatch of mismatches) console.error(`- 불일치: ${mismatch}`);
    if (pathRows.length !== 4) console.error(`- 불일치: 기관사칭 단계 expected=4, actual=${pathRows.length}`);
    process.exitCode = 1;
    return;
  }

  console.log("- 원본 JSON과 일치: PASS");
}
