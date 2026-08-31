import assert from "node:assert/strict";

import { handleIntent } from "../intent.js";
import { retrieveIntentContext } from "../retrieval/rag.js";

const apiKey = process.env.GEMINI_API_KEY || "";

const CASES = [
  {
    name: "기관사칭 안전계좌",
    expectedGraph: "institution_impersonation",
    query: "검찰 수사관이 070 전화로 통화를 끊지 말고 안전계좌로 송금하라고 했어요. 아직 송금하거나 앱을 설치하지는 않았어요.",
  },
  {
    name: "대출 선입금",
    expectedGraph: "loan_advance_fee",
    query: "은행 상담사라는 사람이 전화로 대출 한도를 높이려면 보증금과 기존 대출 상환금을 먼저 보내라고 했어요.",
  },
  {
    name: "투자 리딩방 추가입금",
    expectedGraph: "investment_fraud",
    query: "카카오톡 주식 리딩방에서 원금과 고수익을 보장한다며 출금하려면 세금과 수수료를 추가 입금하라고 했어요.",
  },
  {
    name: "악성 앱 원격제어",
    expectedGraph: "malicious_app",
    query: "대출 상담사가 문자로 보낸 앱을 설치하고 원격제어를 허용해야 대출을 받을 수 있다고 했어요.",
  },
];

function sourceSummary(records = []) {
  return records.slice(0, 3).map((record) => ({
    source: record.source_dataset,
    score: record.score,
    title: record.title,
    publisher: record.publisher,
    page: record.page,
  }));
}

async function verifyHybridFlow() {
  const failures = [];
  const summaries = [];

  for (const testCase of CASES) {
    try {
      const input = {
        transfer: {
          amount: 12_000_000,
          is_first_transfer: true,
          call_in_progress: testCase.expectedGraph === "institution_impersonation",
        },
        messages: [{ role: "user", text: testCase.query }],
      };
      const retrieval = await retrieveIntentContext(input, { apiKey });
      const expectedPath = retrieval.graph?.paths?.find(
        (path) => path.fraud_type_code === testCase.expectedGraph,
      );

      assert.match(retrieval.method, /vector_search.*neo4j_graph/);
      assert.ok(retrieval.fraud.length > 0, "JSON 사기 사례 검색 결과 없음");
      assert.ok(retrieval.normal.length > 0, "JSON 정상 대조군 검색 결과 없음");
      assert.ok(retrieval.official.length > 0, "공식 PDF 검색 결과 없음");
      assert.ok(retrieval.official.every((record) => record.title && record.publisher && record.page), "PDF 출처 메타데이터 누락");
      assert.equal(retrieval.graph?.status, "ready");
      assert.ok(expectedPath, `예상 그래프 유형 누락: ${testCase.expectedGraph}`);
      assert.ok(expectedPath.steps.length >= 4, "사기 진행 경로 단계 부족");

      summaries.push({
        name: testCase.name,
        vectorFraud: sourceSummary(retrieval.fraud),
        vectorOfficial: sourceSummary(retrieval.official),
        graphType: expectedPath.fraud_type_label,
        graphScore: expectedPath.score,
        graphChain: expectedPath.steps.map((step) => step.label).join(" → "),
      });
    } catch (error) {
      failures.push(`${testCase.name}: ${error.message}`);
    }
  }

  // 최종 사용자 답변까지 근거가 전달되는 대표 E2E 1건.
  try {
    const e2e = await handleIntent({
      transfer: {
        userId: "demo-parent-01",
        amount: 12_000_000,
        bank: "수협",
        recipientName: "김수형",
        occurredAt: "2026-08-31T18:00:00+09:00",
        isFirstTransfer: true,
        patternRiskScore: 40,
        callInProgress: true,
      },
      messages: [{ role: "user", text: CASES[0].query }],
      turn: 8,
    }, apiKey);
    const evidence = e2e.analysis?.retrieval || {};
    const expectedPath = evidence.knowledge_graph?.paths?.find(
      (path) => path.fraud_type_code === CASES[0].expectedGraph,
    );

    assert.equal(e2e.risk.level, "HIGH");
    assert.ok(evidence.fraud_evidence?.length > 0, "최종 분석에 JSON 근거 누락");
    assert.ok(evidence.official_document_evidence?.length > 0, "최종 분석에 PDF 근거 누락");
    assert.equal(evidence.knowledge_graph?.status, "ready");
    assert.ok(expectedPath, "최종 분석에 기관사칭 그래프 경로 누락");
    assert.equal(evidence.transaction_pattern?.status, "ready", "최종 분석에 개인 거래 패턴 누락");
    assert.equal(evidence.transaction_pattern?.recipient_known, false, "신규 수취인 판정 오류");
    assert.ok(evidence.transaction_pattern?.risk_score >= 30, "거래 패턴 위험 점수 누락");
    assert.ok(evidence.transaction_pattern?.risk_reasons?.length >= 3, "거래 패턴 위험 근거 부족");
    assert.doesNotMatch(e2e.message, /PDF|Neo4j|Vector|KISA|은행연합회|\d+\s*쪽|문서명|출처/i);
    assert.match(e2e.message, /검찰|국가기관|안전계좌/);

    summaries.push({
      name: "최종 사용자 답변 E2E",
      risk: `${e2e.risk.level} ${e2e.risk.score}점`,
      fraudType: e2e.analysis?.suspected_fraud_type?.label,
      jsonEvidenceCount: evidence.fraud_evidence.length,
      pdfEvidenceCount: evidence.official_document_evidence.length,
      graphPathCount: evidence.knowledge_graph.paths.length,
      transactionPattern: {
        status: evidence.transaction_pattern.status,
        averageTransferAmount: evidence.transaction_pattern.average_transfer_amount,
        maximumTransferAmount: evidence.transaction_pattern.maximum_transfer_amount,
        recipientKnown: evidence.transaction_pattern.recipient_known,
        riskScore: evidence.transaction_pattern.risk_score,
        riskReasons: evidence.transaction_pattern.risk_reasons,
      },
      message: e2e.message,
    });
  } catch (error) {
    failures.push(`최종 사용자 답변 E2E: ${error.message}`);
  }

  console.log(JSON.stringify({
    result: failures.length ? "FAIL" : "PASS",
    cases: summaries,
    failures,
  }, null, 2));

  if (failures.length) process.exitCode = 1;
}

if (!apiKey) {
  console.error("GEMINI_API_KEY가 없습니다.");
  process.exitCode = 1;
} else {
  await verifyHybridFlow();
}
