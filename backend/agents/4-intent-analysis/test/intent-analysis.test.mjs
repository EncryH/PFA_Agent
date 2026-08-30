import test from "node:test";
import assert from "node:assert/strict";

import { classifyFraudType } from "../rules/fraud-types.js";
import { enforceSingleProbeQuestion, generateUserResponse, validateUserResponse } from "../llm/gemini.js";
import { handleIntent, selectProbeQuestion } from "../intent.js";
import { retrieveIntentContext } from "../retrieval/rag.js";
import { rankVectorRecords } from "../retrieval/vector-search.js";
import { extractRuleContradictions, extractRuleSignals, scoreSignals } from "../rules/signals.js";

test("사기·정상·공식 PDF 근거를 동시에 검색한다", async () => {
  const result = await retrieveIntentContext({
    transfer: { amount: 3_000_000, isFirstTransfer: true },
    messages: [{ role: "user", text: "대출을 받으려면 보증금을 먼저 보내야 한대요" }],
  });
  assert.ok(result.fraud.length > 0);
  assert.ok(result.normal.length > 0);
  assert.ok(result.official.length > 0);
  assert.equal(result.fraud[0].kind, "fraud_context_candidate");
  assert.equal(result.normal[0].kind, "normal_financial_control");
  assert.equal(result.official[0].kind, "official_fraud_document");
  assert.ok(result.official[0].title);
  assert.ok(result.official[0].publisher);
  assert.ok(result.official[0].page > 0);
});

test("공식 PDF 벡터 결과는 문서명·기관·페이지 출처를 보존한다", () => {
  const records = [{
    chunk_id: "official:p1#1",
    record_id: "official:p1",
    kind: "official_fraud_document",
    source_dataset: "official_financial_fraud_pdf_8",
    review_status: "official_source_extracted",
    title: "전자금융범죄",
    publisher: "법제처",
    source_url: "https://example.com/official",
    page: 12,
    text: "기관 사칭 안전계좌 송금 요구",
    embedding: [1, 0],
  }];

  const result = rankVectorRecords(records, [1, 0], "official_fraud_document", {
    limit: 4,
    minSimilarity: 0.3,
  });
  assert.equal(result[0].title, "전자금융범죄");
  assert.equal(result[0].publisher, "법제처");
  assert.equal(result[0].page, 12);
  assert.equal(result[0].source_url, "https://example.com/official");
});

test("맞춤 답변은 내부 출처와 사기 확정 표현을 차단한다", () => {
  assert.throws(
    () => validateUserResponse("은행연합회 PDF 9쪽을 보면 확실한 사기입니다. 지금 송금하지 마세요.", "risk"),
    /내부 출처|사기 확정/,
  );
});

test("고령 사용자용 위험 답변은 행동 번호 사이를 띄워 보여준다", () => {
  const message = validateUserResponse(
    "기관에서 송금을 요구했어요. 기관 사칭 수법과 비슷해요.\n\n지금 해야 할 일이에요\n1. 송금하지 마세요.\n2. 공식 번호로 확인하세요.\n3. 요구에 응답하지 마세요.\n4. 대화를 보관하고 신고하세요.",
    "risk",
  );
  assert.match(message, /^확인한 내용이에요\n\n기관에서 송금을 요구했어요\./);
  assert.match(message, /왜 위험한가요\n\n기관 사칭 수법과 비슷해요\./);
  assert.match(message, /1\. 송금하지 마세요\.\n\n2\. 공식 번호로 확인하세요\./);
  assert.match(message, /3\. 요구에 응답하지 마세요\.\n\n4\. 대화를 보관하고 신고하세요\./);
});

test("추가 확인은 근거 결합에서 가장 중요한 공백 하나만 묻는다", () => {
  const requesterQuestion = selectProbeQuestion({
    requester: "",
    channel: "",
    requested_actions: ["세금 선입금"],
  }, { codes: ["ADDITIONAL_PAYMENT_REQUEST"] }, [
    { role: "user", text: "투자 수익을 찾으려면 세금을 먼저 보내야 한대요" },
  ]);
  assert.equal(requesterQuestion, "이전에 같은 이유로 돈을 보낸 적이 있나요?");
  assert.equal((requesterQuestion.match(/[?？]/g) || []).length, 1);

  const channelQuestion = selectProbeQuestion({
    requester: "토스증권",
    channel: "unknown",
    requested_actions: ["세금 선입금"],
  }, { codes: ["ADDITIONAL_PAYMENT_REQUEST"] }, [
    { role: "ai", text: "누가 돈을 보내라고 했나요?" },
    { role: "user", text: "아직 돈을 보낸 적은 없고 토스증권이라고 했어요" },
  ]);
  assert.equal(channelQuestion, "전화, 문자, 카카오톡 중 어떻게 연락해 왔나요?");
  assert.equal((channelQuestion.match(/[?？]/g) || []).length, 1);

  const screenshotCase = selectProbeQuestion({
    requester: "검찰",
    channel: "전화",
    requested_actions: ["안전계좌 송금"],
  }, { codes: ["SAFE_ACCOUNT_TRANSFER", "AGENCY_IMPERSONATION"] }, [
    { role: "ai", text: "처음 보내는 계좌예요. 어떤 돈인지 여쭤봐도 될까요?" },
    { role: "user", text: "검찰이 제 계좌가 범죄에 이용됐다며 안전계좌로 옮기래요" },
  ]);
  assert.equal(screenshotCase, "어떤 전화번호로 연락이 왔나요?");
});

test("송금 화면이 아는 수취 정보와 이미 답한 전화번호는 다시 묻지 않는다", () => {
  const question = selectProbeQuestion({
    purpose: "안전계좌 이전",
    requester: "검찰청 수사관",
    channel: "전화",
    requested_actions: ["transfer"],
    next_question: "",
  }, { codes: ["SAFE_ACCOUNT_TRANSFER", "AGENCY_IMPERSONATION"] }, [
    { role: "user", text: "검찰에서 [전화번호]로 전화해 안전계좌로 보내라고 했어요" },
  ], {
    recipient_display_type: "개인 이름으로 표시된 계좌",
    is_first_transfer: true,
  });

  assert.equal(question.includes("전화번호"), false);
  assert.equal(question.includes("계좌 주인"), false);
});

test("LLM 필드가 비어도 사용자 문장에 나온 요청자와 연락 경로는 다시 묻지 않는다", () => {
  const question = selectProbeQuestion({
    requester: "",
    channel: "unknown",
    requested_actions: ["transfer"],
  }, { codes: ["SAFE_ACCOUNT_TRANSFER", "AGENCY_IMPERSONATION"] }, [
    { role: "user", text: "검찰 수사관이 전화해서 안전계좌로 보내라고 했어요" },
  ]);

  assert.equal(question, "어떤 전화번호로 연락이 왔나요?");
});

test("앱 설치 요구가 확인되면 피해 대응을 바꾸는 설치 여부를 먼저 묻는다", () => {
  const question = selectProbeQuestion({
    purpose: "대출 한도 상향",
    requester: "금융회사 직원",
    channel: "전화",
    requested_actions: ["install_app"],
  }, { codes: ["APP_INSTALLATION_REQUEST", "AGENCY_IMPERSONATION"] }, [
    { role: "user", text: "금융회사 직원이 전화해서 대출 앱을 설치하래요" },
  ]);

  assert.equal(question, "그 앱을 이미 설치하셨나요?");
});

test("위험 답변에 제목이 없어도 번호 목록을 기준으로 세 구역을 강제한다", () => {
  const message = validateUserResponse(
    "검찰이라며 안전계좌로 보내라고 했어요. 국가기관은 개인에게 돈을 요구하지 않아요. 지금 바로 이렇게 행동해 주세요.\n1. 송금하지 마세요.\n2. 공식 번호로 확인하세요.\n3. 요구에 응답하지 마세요.\n4. 대화를 보관하고 신고하세요.",
    "risk",
  );
  assert.match(message, /^확인한 내용이에요/);
  assert.match(message, /왜 위험한가요/);
  assert.match(message, /지금 해야 할 일이에요/);
  assert.match(message, /1\. 송금하지 마세요\./);
});

test("Gemini가 제목에 기호를 붙여도 사용자 화면에는 남기지 않는다", () => {
  const message = validateUserResponse(
    "[확인한 내용이에요]\n검찰에서 연락이 왔어요.\n\n[왜 위험한가요]\n안전계좌 송금 요구는 위험해요.\n\n[지금 해야 할 일이에요]\n1. 송금하지 마세요.\n2. 공식 번호로 확인하세요.\n3. 요구에 응답하지 마세요.\n4. 대화를 보관하고 신고하세요.",
    "risk",
  );
  assert.equal(message.includes("["), false);
  assert.match(message, /^확인한 내용이에요/);
});

test("추가 질문 답변의 제목은 중복 없이 의미 단위로 분리한다", () => {
  const message = enforceSingleProbeQuestion(
    "[확인한 내용이에요]\n검찰의 연락을 받아 놀라셨겠어요.\n\n[왜 확인하나요]\n국가기관은 안전계좌 송금을 요구하지 않아요. 사칭 수법과 비슷해요.\n\n[한 가지만 확인할게요]\n기존 질문?",
    "어떤 전화번호로 연락이 왔나요?",
  );
  assert.equal((message.match(/왜 확인하나요/g) || []).length, 1);
  assert.equal((message.match(/[?？]/g) || []).length, 1);
  assert.equal(message.includes("["), false);
  assert.match(message, /확인한 내용이에요[\s\S]*왜 확인하나요[\s\S]*한 가지만 확인할게요/);
});

test("규칙 판정 뒤 Gemini가 사용자 상황을 반영한 자연스러운 위험 답변을 만든다", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify({
      message: "검찰이라고 한 사람이 070 번호로 연락해 안전계좌 송금을 요구했군요. 수사기관은 전화로 다른 계좌에 돈을 옮기라고 하지 않아요. 기관을 사칭한 금융사기 가능성이 높으니 지금은 이렇게 해 주세요.\n1. 송금하지 말고 통화를 끊으세요.\n2. 공식 대표번호로 직접 확인하세요.\n3. 안전계좌 요구에는 응답하지 마세요.\n4. 대화와 번호를 보관해 112에 신고하세요.",
    }) }] } }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  try {
    const message = await generateUserResponse({
      mode: "risk",
      transfer: { amount_band: "300만원 이상", is_first_transfer: true },
      messages: [{ role: "user", text: "검찰 김수형이라고 했고 070 번호로 연락해 안전계좌로 옮기래요" }],
      llm: { evidence_phrases: ["검찰", "070 번호", "안전계좌"] },
      risk: { level: "HIGH", score: 100, codes: ["AGENCY_IMPERSONATION", "SAFE_ACCOUNT_TRANSFER"] },
      fraudType: { code: "institution_impersonation", label: "은행·기관을 사칭한 사기" },
      retrieval: { fraud: [], normal: [], official: [] },
      requiredMessage: "1. 송금 중단\n2. 공식 번호 확인\n3. 안전계좌 거절\n4. 증거 보관·신고",
    }, "test-key");
    assert.match(message, /검찰/);
    assert.match(message, /070 번호/);
    assert.match(message, /안전계좌/);
    assert.equal(message.includes("PDF"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("벡터 검색은 의미가 가까운 청크를 고르고 같은 상담 기록은 중복 제거한다", () => {
  const records = [
    {
      chunk_id: "fraud-1#1", record_id: "fraud-1", kind: "fraud_context_candidate",
      source_dataset: "test", review_status: "reviewed", text: "안전계좌 송금 요구",
      embedding: [1, 0],
    },
    {
      chunk_id: "fraud-1#2", record_id: "fraud-1", kind: "fraud_context_candidate",
      source_dataset: "test", review_status: "reviewed", text: "같은 사건의 다른 부분",
      embedding: [0.9, 0.1],
    },
    {
      chunk_id: "fraud-2#1", record_id: "fraud-2", kind: "fraud_context_candidate",
      source_dataset: "test", review_status: "reviewed", text: "관련 없는 사례",
      embedding: [0, 1],
    },
  ];

  const result = rankVectorRecords(records, [1, 0], "fraud_context_candidate", {
    limit: 3,
    minSimilarity: 0.3,
  });
  assert.deepEqual(result.map((record) => record.id), ["fraud-1"]);
  assert.equal(result[0].chunk_id, "fraud-1#1");
  assert.equal(result[0].score, 1);
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

test("기관이 가족에게 말하지 말라고 한 상황을 가족 사칭으로 오분류하지 않는다", () => {
  const result = classifyFraudType({
    llm: { requester: "검찰청 수사관", purpose: "안전계좌 이전" },
    signals: ["AGENCY_IMPERSONATION", "SAFE_ACCOUNT_TRANSFER", "SECRECY_INSTRUCTION"],
    messages: [{ role: "user", text: "검찰에서 가족에게 말하지 말고 안전계좌로 옮기라고 했어요" }],
  });
  assert.equal(result.code, "institution_impersonation");
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
              grounding_evidence_ids: [],
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
      turn: 8,   // 비상 상한에 도달하면 안전 판정을 확정한다
    }, "test-key");

    assert.equal(sentBody.includes("110-123-456789"), false);
    assert.equal(sentBody.includes("010-1234-5678"), false);
    assert.equal(result.analysis.suspected_fraud_type.code, "loan_advance_fee");
    assert.equal(result.analysis.impersonation, "bank");
    assert.equal(result.analysis.attack_stage, "money_request");
    assert.deepEqual(result.analysis.evidence_phrases, ["보증금을 보내래요"]);
    // 사기 유형이 확정되면 그 유형에 맞는 금감원 사례·영상이 붙는다
    assert.equal(result.analysis.official_content.status, "curated");
    assert.equal(result.analysis.official_content.fraud_type, "loan_advance_fee");
    const kinds = result.analysis.official_content.items.map((item) => item.kind);
    assert.deepEqual(kinds, ["video", "case_board"]);
    assert.ok(result.analysis.retrieval.fraud_evidence.length > 0);
    assert.ok(result.analysis.retrieval.normal_evidence.length > 0);
    assert.equal(result.risk.level, "HIGH");
    assert.match(result.message, /대출을 빙자한 사기가 의심돼요/);
    assert.match(result.message, /보증금이나 수수료를 먼저/);
    assert.match(result.message, /지금 해야 할 일이에요/);
    assert.match(result.message, /1\. 지금은/);
    assert.match(result.message, /2\. 해당 금융사의 공식 앱/);
    assert.match(result.message, /3\. 보증금·수수료/);
    assert.match(result.message, /4\. 대화·문자/);
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
            grounding_evidence_ids: [],
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
      turn: 8,
    }, "test-key");

    assert.ok(result.risk.codes.includes("ANSWER_CONTRADICTION"));
    assert.match(result.message, /송금 이유가 앞뒤에서 달라요/);
    assert.match(result.message, /처음에는 병원비/);
    assert.match(result.message, /지금은 송금하지 말고/);
    assert.ok(result.message.length < 350);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("고위험도 필요한 근거가 비면 계속 묻고 답을 받으면 결론을 낸다", async () => {
  const originalFetch = globalThis.fetch;
  const llmReply = {
    done: true,                       // LLM 이 그만하자고 해도 규칙이 더 묻게 한다
    next_question: "",
    purpose: "안전계좌 이전",
    requester: "검찰청 수사관",
    channel: "전화",
    impersonation: "prosecution",
    interaction_direction: "external_actor_to_customer",
    attack_stage: "money_request",
    signals: ["SAFE_ACCOUNT_TRANSFER", "AGENCY_IMPERSONATION"],
    fraud_type: "agency_impersonation",
    requested_actions: ["transfer"],
    answer_contradictions: [],
    missing_information: [],
    evidence_phrases: ["안전계좌로 옮기래요"],
    grounding_evidence_ids: [],
    explanation: "기관을 사칭해 안전계좌로 옮기라는 요구입니다.",
  };
  globalThis.fetch = async () => new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify(llmReply) }] } }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  const body = (turn, messages) => ({
    transfer: { amount: 12_000_000, isFirstTransfer: true, patternRiskScore: 40 },
    messages,
    turn,
  });

  try {
    const firstUser = { role: "user", text: "검찰청에서 전화가 와서 안전계좌로 옮기라고 했어요" };
    const first = await handleIntent(body(1, [firstUser]), "test-key");
    assert.equal(first.risk.level, "HIGH");     // 위험은 이미 확인됐다
    assert.equal(first.hold, false);            // 그래도 아직 보류하지 않는다
    assert.equal(first.done, false);            // 대화를 계속한다
    assert.match(first.message, /확인한 내용이에요/);
    assert.match(first.message, /한 가지만 확인할게요/);
    assert.match(first.message, /어떤 전화번호/);           // 연락 출처를 확인하는 단일 후속 질문
    assert.equal((first.message.match(/[?？]/g) || []).length, 1);

    const unanswered = await handleIntent(body(2, [firstUser]), "test-key");
    assert.equal(unanswered.done, false);
    assert.match(unanswered.message, /어떤 전화번호/);

    const stillMissingAtFourth = await handleIntent(body(4, [firstUser]), "test-key");
    assert.equal(stillMissingAtFourth.done, false);
    assert.match(stillMissingAtFourth.message, /어떤 전화번호/);

    const second = await handleIntent(body(2, [
      firstUser,
      { role: "ai", text: first.message },
      { role: "user", text: "070 번호로 전화가 왔어요" },
    ]), "test-key");
    assert.equal(second.hold, true);
    assert.equal(second.done, true);
    assert.match(second.message, /지금 해야 할 일이에요/);
    assert.match(second.message, /1\. 지금은/);
    assert.match(second.message, /4\./);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("LLM 없이 폴백이어도 근거가 비면 4턴 이후 계속 묻고 채워지면 결론을 낸다", async () => {
  const transfer = { amount: 12_000_000, isFirstTransfer: true, patternRiskScore: 40, callInProgress: true };
  const firstUser = { role: "user", text: "대출받으려면 보증금을 먼저 보내라고 해서요" };

  const first = await handleIntent({ transfer, messages: [firstUser], turn: 1 }, "");   // 키 없음 → 폴백
  assert.equal(first.fallback, true);
  assert.equal(first.risk.level, "HIGH");
  assert.equal(first.hold, false);
  assert.equal(first.done, false);

  const fourth = await handleIntent({ transfer, messages: [firstUser], turn: 4 }, "");
  assert.equal(fourth.fallback, true);
  assert.equal(fourth.hold, false);
  assert.equal(fourth.done, false);

  const completedMessages = [
    firstUser,
    { role: "ai", text: first.message },
    { role: "user", text: "은행 직원이 070-1234-5678 번호로 전화했고, 아직 돈은 보내지 않았어요" },
  ];
  const completed = await handleIntent({ transfer, messages: completedMessages, turn: 5 }, "");
  assert.equal(completed.fallback, true);
  assert.equal(completed.hold, true);
  assert.equal(completed.done, true);
  assert.match(completed.message, /지금 해야 할 일이에요/);
});
