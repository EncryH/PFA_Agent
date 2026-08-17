// /api/intent 핸들러
//
// 흐름:  대화 → [Gemini] 신호 추출 → [규칙] 채점 → [규칙] 보류 판정 → 응답
//
// LLM 이 done 을 true 로 줘도 그건 '더 물을 게 없다'는 의견일 뿐이다.
// 실제로 송금을 멈출지는 아래 규칙만이 결정한다.

import { extractIntent } from "./gemini.js";
import {
  extractRuleContradictions, extractRuleSignals, scoreSignals,
  MAX_TURNS, MIN_TURNS_BEFORE_VERDICT,
} from "./signals.js";
import { classifyFraudType } from "./fraud-types.js";
import { retrieveIntentContext } from "./rag.js";
import { retrieveOfficialContent } from "./official-content.js";
import { safeTransferContext, sanitizeMessages } from "./sanitize.js";

const FALLBACK_QUESTIONS = [
  "누가 보내 달라고 했나요?",
  "전화, 문자, 카카오톡 중 무엇으로 연락받으셨나요?",
  "혹시 지금도 그 사람과 통화 중이신가요?",
];

/**
 * 위험 신호가 이미 잡혔지만 아직 결론을 내기 전에 더 캐물을 질문.
 * 신호 종류에 맞춰 물어야 가족에게 넘길 근거가 구체화된다.
 */
const PROBE_QUESTIONS = Object.freeze({
  AGENCY_IMPERSONATION:        "그 기관 이름과 담당자 이름을 들으셨나요? 어떤 번호로 연락이 왔는지도 알려주세요.",
  SAFE_ACCOUNT_TRANSFER:       "'안전계좌'라는 말을 그쪽에서 먼저 했나요? 계좌 주인 이름도 알려줬는지 궁금해요.",
  PREPAY_CONTRADICTION:        "먼저 보내면 언제 돌려준다고 했나요? 그 약속을 문서로 받으셨어요?",
  PERSONAL_ACCOUNT_FOR_AGENCY: "기관인데 개인 이름 계좌를 알려줬나요? 계좌 주인 이름이 무엇이었나요?",
  SECRECY_INSTRUCTION:         "가족에게 말하지 말라는 이야기도 들으셨나요? 왜 그러라고 했는지 기억나세요?",
  CALL_IN_PROGRESS:            "지금도 그 사람과 통화 중이신가요? 전화를 끊으라고 하면 뭐라고 하던가요?",
  CREDENTIAL_REQUEST:          "비밀번호나 인증번호를 알려달라고 했나요? 이미 알려주셨어요?",
  APP_INSTALLATION_REQUEST:    "설치하라고 한 앱 이름이 무엇이었나요? 지금 설치돼 있나요?",
  GUARANTEED_RETURN:           "수익을 얼마나 보장한다고 했나요? 그 사람을 어떻게 알게 되셨어요?",
  ADDITIONAL_PAYMENT_REQUEST:  "이번이 몇 번째 입금인가요? 지금까지 보낸 금액이 얼마인지 알려주세요.",
  CHANGED_FAMILY_CONTACT:      "원래 알던 번호가 아닌가요? 목소리로 직접 통화해서 확인해 보셨어요?",
  URGENCY:                     "언제까지 보내야 한다고 했나요? 늦으면 어떻게 된다고 하던가요?",
});

const DEFAULT_PROBE = "조금만 더 여쭤볼게요. 그분이 정확히 어떤 이유로 이 계좌에 보내라고 했나요?";

const PASS_MESSAGE = "확인했어요.\n\n지금 말씀해 주신 내용에서는 위험한 점이 발견되지 않았어요.\n\n송금을 계속할 수 있어요.";

/**
 * @param {{transfer: object, messages: {role: string, text: string}[], turn: number}} body
 * @param {string} apiKey
 */
export async function handleIntent(body, apiKey) {
  const { transfer = {}, messages = [], turn = 1 } = body;
  const safeTransfer = safeTransferContext(transfer);
  const safeMessages = sanitizeMessages(messages);
  const retrieval = retrieveIntentContext({ transfer: safeTransfer, messages: safeMessages });

  let llm;
  try {
    llm = await extractIntent(safeTransfer, safeMessages, apiKey, retrieval);
  } catch (err) {
    const reason = /Gemini 429/.test(err.message) ? "quota"
                 : /Gemini 4/.test(err.message)   ? "auth"
                 : "unavailable";
    console.error(`[intent] Gemini 실패(${reason}) → 폴백:`, err.message.slice(0, 200));
    return {
      ...fallback({ turn, retrieval, safeTransfer, safeMessages }),
      fallbackReason: reason,
    };
  }

  const contradictions = normalizeStringList(llm.answer_contradictions);
  const hasConversationContradiction = contradictions.length > 0
    && safeMessages.filter((message) => message.role !== "ai").length >= 2;
  const observedSignals = [
    ...(Array.isArray(llm.signals) ? llm.signals : []),
    ...(safeTransfer.call_in_progress ? ["CALL_IN_PROGRESS"] : []),
    ...(hasConversationContradiction ? ["ANSWER_CONTRADICTION"] : []),
  ];
  const risk = scoreSignals(observedSignals, {
    patternRiskScore: safeTransfer.pattern_risk_score,
  });
  const fraudType = classifyFraudType({
    llm,
    signals: risk.codes || observedSignals,
    messages: safeMessages,
  });
  const officialContent = retrieveOfficialContent(fraudType.code);
  const analysis = buildAnalysis(llm, risk, fraudType, retrieval, officialContent);
  const outOfTurns = turn >= MAX_TURNS;

  // ── 판정: 규칙만이 결정한다 ──
  //
  // 위험이 확인됐어도 최소 질문 수를 채우기 전에는 결론을 내지 않는다.
  // 대신 무엇이 걱정되는지 지금 알려주고 한 단계 더 캐묻는다.
  // 송금은 이 동안에도 정지 상태이므로 지연으로 인한 위험 증가는 없다.
  const verdictReady = turn >= MIN_TURNS_BEFORE_VERDICT || outOfTurns;

  if (risk.level === "HIGH" && !verdictReady) {
    return {
      message: buildProbeMessage(risk, fraudType, llm),
      hold: false,
      done: false,
      risk,
      intent: pickIntent(llm),
      analysis,
      fallback: false,
    };
  }

  if (risk.level === "HIGH" || ((llm.done || outOfTurns) && risk.score > 0)) {
    return {
      message: buildRiskMessage(llm, risk, fraudType),
      hold: true,
      done: true,
      risk,
      intent: pickIntent(llm),
      analysis,
      fallback: false,
    };
  }

  // 위험 점수가 있는데 LLM이 그만하자고 하면, 최소 질문 수까지는 계속 묻는다
  if (llm.done && risk.score > 0 && !verdictReady) {
    return {
      message: buildProbeMessage(risk, fraudType, llm),
      hold: false,
      done: false,
      risk,
      intent: pickIntent(llm),
      analysis,
      fallback: false,
    };
  }

  if (llm.done || outOfTurns) {
    return {
      message: PASS_MESSAGE,
      hold: false,
      done: true,
      risk,
      intent: pickIntent(llm),
      analysis,
      fallback: false,
    };
  }

  return {
    message: llm.next_question || FALLBACK_QUESTIONS[0],
    hold: false,
    done: false,
    risk,
    intent: pickIntent(llm),
    analysis,
    fallback: false,
  };
}

const pickIntent = (llm) => ({
  purpose: llm.purpose || "",
  requester: llm.requester || "",
  channel: llm.channel || "",
});

/**
 * 결론 전 중간 응답 — 지금 걱정되는 점을 먼저 알려주고 한 가지 더 묻는다.
 * 판정을 미루는 것이지 위험을 숨기는 것이 아니므로, 경고는 이 시점에 이미 전달한다.
 */
function buildProbeMessage(risk, fraudType, llm) {
  const topCode = risk.codes.find((code) => EASY_REASONS[code]);
  const concern = topCode
    ? `${EASY_REASONS[topCode]}`
    : compactExplanation(llm.explanation);

  // 아직 캐묻지 않은 신호 중 가장 점수가 높은 것을 골라 질문한다
  const question = risk.codes.map((code) => PROBE_QUESTIONS[code]).find(Boolean)
    || llm.next_question
    || DEFAULT_PROBE;

  return [
    "잠시만요, 확인이 필요해 보여요.",
    concern ? `걱정되는 점이 있어요.\n${concern}` : "",
    "정확히 판단하려면 조금 더 알아야 해요.",
    question,
  ].filter(Boolean).join("\n\n");
}

function buildRiskMessage(llm, risk, fraudType) {
  const opening = RISK_OPENINGS[fraudType.code] || "금융사기가 의심돼요.";
  const contradiction = normalizeStringList(llm.answer_contradictions)[0];
  const contradictionText = contradiction
    ? `말씀하신 송금 이유가 앞뒤에서 달라요.\n${compactMultiline(contradiction, 2, 45)}`
    : "";
  const reasons = risk.codes
    .filter((code) => code !== "ANSWER_CONTRADICTION")
    .map((code) => EASY_REASONS[code])
    .filter(Boolean)
    .slice(0, 2);
  const reasonText = reasons.length
    ? `이 점이 위험해요.\n${reasons.join(" ")}`
    : compactExplanation(llm.explanation);
  const action = safeActionFor(fraudType.code, risk.codes);
  return [opening, contradictionText, reasonText, action]
    .filter(Boolean)
    .join("\n\n");
}

const RISK_OPENINGS = Object.freeze({
  institution_impersonation: "은행이나 기관을 사칭한 연락이 의심돼요.",
  loan_advance_fee: "대출을 빙자한 사기가 의심돼요.",
  refund_advance_fee: "환급이나 당첨금을 빙자한 사기가 의심돼요.",
  family_or_acquaintance_impersonation: "가족이나 지인을 사칭한 연락이 의심돼요.",
  smishing: "문자나 링크를 이용한 사기가 의심돼요.",
  malicious_app: "악성 앱을 이용한 사기가 의심돼요.",
  personal_information_phishing: "개인정보를 노린 사기가 의심돼요.",
  investment_fraud: "투자를 빙자한 사기가 의심돼요.",
  job_or_mission_fraud: "부업이나 미션을 빙자한 사기가 의심돼요.",
});

const EASY_REASONS = Object.freeze({
  SAFE_ACCOUNT_TRANSFER: "안전한 계좌로 돈을 옮기라고 했어요.",
  SECRECY_INSTRUCTION: "가족이나 은행에 말하지 말라고 했어요.",
  PREPAY_CONTRADICTION: "돈을 받기 전에 보증금이나 수수료를 먼저 내라고 했어요.",
  CREDENTIAL_REQUEST: "비밀번호나 인증번호를 알려 달라고 했어요.",
  APP_INSTALLATION_REQUEST: "상대가 낯선 앱을 설치하라고 했어요.",
  MALICIOUS_URL: "출처가 분명하지 않은 링크를 누르라고 했어요.",
  PERSONAL_DATA_REQUEST: "신분증이나 개인정보를 보내라고 했어요.",
  CALL_IN_PROGRESS: "상대와 통화하면서 송금하려고 하고 있어요.",
  AGENCY_IMPERSONATION: "은행이나 기관이라고 말한 상대가 돈을 요구했어요.",
  PERSONAL_ACCOUNT_FOR_AGENCY: "기관이라고 하면서 개인 이름의 계좌로 보내라고 했어요.",
  GUARANTEED_RETURN: "원금이나 높은 수익을 보장한다고 했어요.",
  ADDITIONAL_PAYMENT_REQUEST: "돈을 돌려받으려면 추가로 입금하라고 했어요.",
  CHANGED_FAMILY_CONTACT: "가족이 평소와 다른 번호로 송금을 요구했어요.",
  EVASIVE: "누가 왜 보내라고 했는지 분명하지 않아요.",
  URGENCY: "지금 바로 보내라고 재촉했어요.",
  SMS_LURE: "의심스러운 문자로 연락이 시작됐어요.",
});

function safeActionFor(fraudType, signalCodes = []) {
  if (fraudType === "family_or_acquaintance_impersonation" || signalCodes.includes("CHANGED_FAMILY_CONTACT")) {
    return "지금은 보내지 마세요. 평소 알고 있던 가족 번호로 직접 전화해 확인해 주세요.";
  }
  if (fraudType === "smishing" || signalCodes.includes("MALICIOUS_URL")) {
    return "지금은 보내지 마세요. 링크를 다시 누르지 말고 은행 앱의 공식 번호로 확인해 주세요.";
  }
  if (fraudType === "malicious_app" || signalCodes.includes("APP_INSTALLATION_REQUEST")) {
    return "지금은 보내지 마세요. 통화를 끊고, 상대가 알려준 앱은 설치하지 마세요.";
  }
  if (["investment_fraud", "job_or_mission_fraud"].includes(fraudType)) {
    return "지금은 보내지 마세요. 돈을 더 넣지 말고 금융회사 공식 번호로 확인해 주세요.";
  }
  return "지금은 보내지 마세요. 상대가 알려준 번호 말고, 은행 앱의 공식 번호로 직접 확인해 주세요.";
}

function softenExplanation(value = "") {
  return String(value)
    .replace(/100%\s*([^.!?]*?)사기입니다/gi, "$1사기일 가능성이 매우 높습니다")
    .replace(/확실한\s*사기(?:입니다|예요)/g, "사기일 가능성이 매우 높습니다")
    .replace(/반드시\s*사기(?:입니다|예요)/g, "사기일 가능성이 매우 높습니다");
}

function compactExplanation(value = "") {
  const softened = softenExplanation(value).replace(/\s+/g, " ").trim();
  if (!softened) return "말씀하신 내용에 위험한 점이 있어 다시 확인해야 해요.";
  return softened
    .split(/(?<=[.!?요다])\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((sentence) => compactSentence(sentence, 70))
    .join("\n");
}

function compactSentence(value, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1).trim()}…`;
}

function compactMultiline(value, maxLines, maxLengthPerLine) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => compactSentence(line, maxLengthPerLine))
    .filter(Boolean)
    .slice(0, maxLines)
    .join("\n");
}

function normalizeStringList(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
}

function buildAnalysis(llm, risk, fraudType, retrieval, officialContent) {
  const publicEvidence = (records) => records.map((record) => ({
    id: record.id,
    score: record.score,
    source_dataset: record.source_dataset,
    review_status: record.review_status,
  }));
  return {
    version: "intent-analysis-v2",
    suspected_fraud_type: fraudType,
    impersonation: llm.impersonation || "unknown",
    interaction_direction: llm.interaction_direction || "unknown",
    attack_stage: llm.attack_stage || "unknown",
    requested_actions: Array.isArray(llm.requested_actions) ? llm.requested_actions : [],
    answer_contradictions: normalizeStringList(llm.answer_contradictions),
    missing_information: normalizeStringList(llm.missing_information),
    evidence_phrases: normalizeStringList(llm.evidence_phrases).slice(0, 5),
    retrieval: {
      method: retrieval.method,
      fraud_evidence: publicEvidence(retrieval.fraud),
      normal_evidence: publicEvidence(retrieval.normal),
    },
    score_components: risk.components,
    official_content: officialContent,
  };
}

/** LLM 장애 시에도 명시적인 위험 표현은 같은 규칙 엔진으로 판정한다. */
function fallback({
  turn,
  retrieval = { method: "none", fraud: [], normal: [] },
  safeTransfer = {},
  safeMessages = [],
}) {
  const localContradictions = extractRuleContradictions(safeMessages);
  const localSignals = [
    ...extractRuleSignals(safeMessages, safeTransfer),
    ...(localContradictions.length ? ["ANSWER_CONTRADICTION"] : []),
  ];
  const risk = scoreSignals(localSignals, {
    patternRiskScore: safeTransfer.pattern_risk_score,
  });
  const localLlm = {
    signals: localSignals,
    answer_contradictions: localContradictions,
    evidence_phrases: [],
  };
  const fraudType = classifyFraudType({
    llm: localLlm,
    signals: risk.codes,
    messages: safeMessages,
  });

  // LLM이 없을 때도 결론 전 최소 질문 수는 같게 지킨다
  if (risk.level === "HIGH" && turn < MIN_TURNS_BEFORE_VERDICT && turn < MAX_TURNS) {
    return {
      message: buildProbeMessage(risk, fraudType, localLlm),
      hold: false,
      done: false,
      risk,
      intent: pickIntent(localLlm),
      analysis: buildAnalysis(localLlm, risk, fraudType, retrieval, retrieveOfficialContent(fraudType.code)),
      fallback: true,
    };
  }

  // Gemini 없이 돌 때도 결론을 서두르지 않는다 — 규칙 질문으로 상황을 먼저 구체화한다
  if (risk.level === "HIGH" && turn < MIN_TURNS_BEFORE_VERDICT && turn < MAX_TURNS) {
    return {
      message: buildProbeMessage(risk, fraudType, localLlm),
      hold: false,
      done: false,
      risk,
      intent: pickIntent(localLlm),
      analysis: buildAnalysis(localLlm, risk, fraudType, retrieval, retrieveOfficialContent(fraudType.code)),
      fallback: true,
    };
  }

  if (risk.level === "HIGH") {
    return {
      message: buildRiskMessage(localLlm, risk, fraudType),
      hold: true,
      done: true,
      risk,
      intent: pickIntent(localLlm),
      analysis: buildAnalysis(localLlm, risk, fraudType, retrieval, retrieveOfficialContent(fraudType.code)),
      fallback: true,
    };
  }

  if (turn >= MAX_TURNS) {
    return {
      message: risk.score > 0
        ? buildRiskMessage(localLlm, risk, fraudType)
        : PASS_MESSAGE,
      hold: risk.score > 0,
      done: true,
      risk,
      intent: pickIntent(localLlm),
      analysis: buildAnalysis(localLlm, risk, fraudType, retrieval, retrieveOfficialContent(fraudType.code)),
      fallback: true,
    };
  }

  const question = FALLBACK_QUESTIONS[Math.min(Math.max(turn - 1, 0), FALLBACK_QUESTIONS.length - 1)];
  return {
    message: question,
    hold: false,
    done: false,
    risk,
    intent: pickIntent(localLlm),
    analysis: buildAnalysis(localLlm, risk, fraudType, retrieval, retrieveOfficialContent(fraudType.code)),
    fallback: true,
  };
}
