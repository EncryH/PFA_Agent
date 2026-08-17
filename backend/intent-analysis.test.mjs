import test from "node:test";
import assert from "node:assert/strict";

import { classifyFraudType } from "./agents/intent-analysis/fraud-types.js";
import { handleIntent } from "./agents/intent-analysis/intent.js";
import { retrieveIntentContext } from "./agents/intent-analysis/rag.js";
import { extractRuleContradictions, extractRuleSignals, scoreSignals } from "./agents/intent-analysis/signals.js";

test("사기·정상 사례를 동시에 검색한다", () => {
  const result = retrieveIntentContext({
    transfer: { amount: 3_000_000, isFirstTransfer: true },
    messages: [{ role: "user", text: "대출을 받으려면 보증금을 먼저 보내야 한대요" }],
  });
  assert.ok(result.fraud.length > 0);
  assert.ok(result.normal.length > 0);
  assert.equal(result.fraud[0].kind, "fraud_context_candidate");
  assert.equal(result.normal[0].kind, "normal_financial_control");
});

test("패턴 점수만으로 사기 의도를 확정하지 않는다", () => {
  assert.equal(scoreSignals([], { patternRiskScore: 35 }).score, 0);
  const risk = scoreSignals(["PREPAY_CONTRADICTION", "PREPAY_CONTRADICTION"], {
    patternRiskScore: 35,
  });
  assert.equal(risk.score, 65);
  assert.deepEqual(risk.codes, ["PREPAY_CONTRADICTION"]);
});

test("대출 선입금 유형을 규칙으로 결정한다", () => {
  const result = classifyFraudType({
    llm: { purpose: "대출 보증금" },
    signals: ["PREPAY_CONTRADICTION"],
  });
  assert.equal(result.code, "loan_advance_fee");
});

test("투자 수익 보장과 가족 새 번호 요구를 규칙으로 채점·분류한다", () => {
  const investmentRisk = scoreSignals(["GUARANTEED_RETURN"], { patternRiskScore: 20 });
  assert.equal(investmentRisk.score, 50);
  assert.equal(classifyFraudType({
    llm: { purpose: "주식 리딩방 투자금" },
    signals: investmentRisk.codes,
  }).code, "investment_fraud");

  assert.equal(classifyFraudType({
    llm: { requester: "딸" },
    signals: ["CHANGED_FAMILY_CONTACT"],
  }).code, "family_or_acquaintance_impersonation");
});

test("Gemini 없이도 명백한 선입금·통화 중 신호를 추출한다", () => {
  const signals = extractRuleSignals([
    { role: "user", text: "대출을 받으려면 보증금을 먼저 보내래요" },
    { role: "user", text: "문자로 연락받았고 지금 통화 중이에요" },
  ]);
  assert.ok(signals.includes("PREPAY_CONTRADICTION"));
  assert.ok(signals.includes("CALL_IN_PROGRESS"));
  assert.ok(signals.includes("SMS_LURE"));
});

test("Gemini 없이도 서로 다른 답변의 송금 목적 변경을 찾는다", () => {
  const contradictions = extractRuleContradictions([
    { role: "user", text: "아빠 병원비를 보내는 돈이에요" },
    { role: "ai", text: "누가 보내 달라고 했나요?" },
    { role: "user", text: "대출 보증금을 보내야 승인된대요" },
  ]);
  assert.equal(contradictions.length, 1);
  assert.match(contradictions[0], /병원비·치료비/);
  assert.match(contradictions[0], /대출 관련 비용/);
});

test("의도 분석은 개인정보를 마스킹하고 근거·유형·점수를 반환한다", async () => {
  const originalFetch = globalThis.fetch;
  let sentBody = "";
  globalThis.fetch = async (_url, options) => {
    sentBody = String(options.body);
    return new Response(JSON.stringify({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              done: true,
              next_question: "",
              purpose: "대출 보증금",
              requester: "은행 상담사",
              channel: "전화",
              impersonation: "bank",
              interaction_direction: "external_actor_to_customer",
              attack_stage: "money_request",
              signals: ["PREPAY_CONTRADICTION", "AGENCY_IMPERSONATION"],
              fraud_type: "loan_advance_fee",
              requested_actions: ["transfer"],
              answer_contradictions: [],
              missing_information: [],
              evidence_phrases: ["보증금을 보내래요"],
              explanation: "대출 전에 돈을 먼저 요구하는 것은 100% 대출사기입니다.",
            }),
          }],
        },
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const result = await handleIntent({
      transfer: {
        amount: 3_000_000,
        recipientName: "홍길동",
        account: "110-123-456789",
        isFirstTransfer: true,
        patternRiskScore: 35,
      },
      messages: [{ role: "user", text: "010-1234-5678로 전화가 와서 보증금을 보내래요" }],
      turn: 1,
    }, "test-key");

    assert.equal(sentBody.includes("110-123-456789"), false);
    assert.equal(sentBody.includes("010-1234-5678"), false);
    assert.equal(result.analysis.suspected_fraud_type.code, "loan_advance_fee");
    assert.equal(result.analysis.impersonation, "bank");
    assert.equal(result.analysis.attack_stage, "money_request");
    assert.deepEqual(result.analysis.evidence_phrases, ["보증금을 보내래요"]);
    assert.equal(result.analysis.official_content.status, "not_configured");
    assert.ok(result.analysis.retrieval.fraud_evidence.length > 0);
    assert.ok(result.analysis.retrieval.normal_evidence.length > 0);
    assert.equal(result.risk.level, "HIGH");
    assert.match(result.message, /대출을 빙자한 사기가 의심돼요/);
    assert.match(result.message, /보증금이나 수수료를 먼저/);
    assert.equal(result.message.includes("100%"), false);
    assert.equal(result.message.includes("확인된 위험 신호"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("대화 앞뒤가 다르면 쉬운 문장으로 알려주고 위험 신호에 반영한다", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    candidates: [{
      content: {
        parts: [{
          text: JSON.stringify({
            done: true,
            next_question: "",
            purpose: "대출 보증금",
            requester: "은행 상담사",
            channel: "전화",
            impersonation: "bank",
            interaction_direction: "external_actor_to_customer",
            attack_stage: "money_request",
            signals: ["PREPAY_CONTRADICTION", "AGENCY_IMPERSONATION", "URGENCY", "ANSWER_CONTRADICTION"],
            fraud_type: "loan_advance_fee",
            requested_actions: ["transfer"],
            answer_contradictions: ["처음에는 병원비라고 했지만, 이후에는 대출 보증금이라고 했어요."],
            missing_information: [],
            evidence_phrases: ["병원비", "대출 보증금", "오늘 안에"],
            explanation: "송금 목적이 달라졌고 먼저 돈을 요구받았어요.",
          }),
        }],
      },
    }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  try {
    const result = await handleIntent({
      transfer: { amount: 3_000_000, isFirstTransfer: true, patternRiskScore: 35 },
      messages: [
        { role: "user", text: "아빠 병원비를 보내는 돈이에요" },
        { role: "ai", text: "누가 보내 달라고 했나요?" },
        { role: "user", text: "은행 상담사가 대출 보증금을 오늘 안에 보내래요" },
      ],
      turn: 2,
    }, "test-key");

    assert.ok(result.risk.codes.includes("ANSWER_CONTRADICTION"));
    assert.match(result.message, /송금 이유가 앞뒤에서 달라요/);
    assert.match(result.message, /처음에는 병원비/);
    assert.match(result.message, /지금은 보내지 마세요/);
    assert.ok(result.message.length < 350);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
