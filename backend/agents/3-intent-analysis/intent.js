// /api/intent 핸들러
//
// 흐름: 대화 → [Gemini] 신호 추출 → [규칙] 판정 → [Gemini] 근거 기반 설명 → 출력 검증
//
// LLM 이 done 을 true 로 줘도 그건 '더 물을 게 없다'는 의견일 뿐이다.
// 실제로 송금을 멈출지는 아래 규칙만이 결정한다.

import { extractIntent, generateUserResponse } from "./llm/gemini.js";
import {
  extractRuleContradictions, extractRuleSignals, scoreSignals,
  MAX_TURNS, MIN_TURNS_BEFORE_VERDICT, HOLD_THRESHOLD,
} from "./rules/signals.js";
import { classifyFraudType } from "./rules/fraud-types.js";
import { retrieveIntentContext } from "./retrieval/rag.js";
import { retrieveOfficialContent } from "./retrieval/official-content.js";
import { safeTransferContext, sanitizeMessages } from "./sanitize.js";
import { retrieveTransactionPattern } from "./text2sql/transaction-pattern.js";
import { resolveSituation, needsDamageResponse } from "../../../shared/conversation-state.js";
import { damageResponsePlan } from "./response-plan.js";
import { dialoguePlan } from "./middleware/dialogue.js";

const FALLBACK_QUESTIONS = [
  "누가 보내 달라고 했나요?",
  "전화, 문자, 카카오톡 중 무엇으로 연락받으셨나요?",
  "혹시 지금도 그 사람과 통화 중이신가요?",
];

const DEFAULT_PROBE = "조금만 더 여쭤볼게요. 그분이 정확히 어떤 이유로 이 계좌에 보내라고 했나요?";

const PASS_MESSAGE = "확인했어요.\n\n지금 말씀해 주신 내용에서는 위험한 점이 발견되지 않았어요.\n\n송금을 계속할 수 있어요.";

// 실제 실행·피해 대응 단계를 바꾸는 신호는 검색 사례나 모델의 추정만으로 인정하지 않는다.
// 사용자 발화 또는 앱이 전달한 행동 신호에서 규칙으로 확인됐을 때만 질문·분석에 사용한다.
const STRICTLY_GROUNDED_SIGNALS = new Set([
  "CREDENTIAL_REQUEST",
  "APP_INSTALLATION_REQUEST",
  "MALICIOUS_URL",
  "PERSONAL_DATA_REQUEST",
  "CALL_IN_PROGRESS",
  "ADDITIONAL_PAYMENT_REQUEST",
]);

const ACTION_SIGNAL_REQUIREMENTS = Object.freeze({
  install_app: "APP_INSTALLATION_REQUEST",
  remote_control: "APP_INSTALLATION_REQUEST",
  click_url: "MALICIOUS_URL",
  share_otp: "CREDENTIAL_REQUEST",
  submit_personal_information: "PERSONAL_DATA_REQUEST",
  submit_id: "PERSONAL_DATA_REQUEST",
  keep_call: "CALL_IN_PROGRESS",
  additional_payment: "ADDITIONAL_PAYMENT_REQUEST",
});

function groundSensitiveLlmClaims(llm = {}, messages = [], transfer = {}) {
  const ruleSignals = new Set(extractRuleSignals(messages, transfer));
  const signals = normalizeStringList(llm.signals)
    .filter((code) => !STRICTLY_GROUNDED_SIGNALS.has(code) || ruleSignals.has(code));
  const requestedActions = normalizeStringList(llm.requested_actions)
    .filter((action) => !ACTION_SIGNAL_REQUIREMENTS[action]
      || ruleSignals.has(ACTION_SIGNAL_REQUIREMENTS[action]));
  return { ...llm, signals, requested_actions: requestedActions, ruleSignals: [...ruleSignals] };
}

/**
 * 사전 분석에서 이미 D등급(강제 최고 위험 포함)으로 확정된 상담은, 대화 내용이
 * 아무리 그럴듯해도(예: "여행 자금이야") 이 판정 로직만으로 안전 쪽으로 결론 내지 않는다.
 * 질문은 평소대로 계속하되, 최종 결론은 항상 위험 판정(hold: true)으로 수렴시켜
 * 가족 확인만이 유일한 통과 경로가 되게 한다.
 */
function applyForcedHold(risk, safeTransfer) {
  if (!safeTransfer.forced_hold) return risk;
  return { ...risk, score: Math.max(risk.score, HOLD_THRESHOLD), level: "HIGH" };
}

/**
 * @param {{transfer: object, messages: {role: string, text: string}[], turn: number}} body
 * @param {string} apiKey
 */
export async function handleIntent(body, apiKey, { graphConfig = {}, databaseConfig = {} } = {}) {
  const { transfer = {}, messages = [], turn = 1 } = body;
  const initialTransfer = safeTransferContext(transfer);
  const safeMessages = sanitizeMessages(messages);
  let situation = resolveSituation(safeMessages, body.conversationState?.situation);
  const [ragRetrieval, transactionPattern] = await Promise.all([
    retrieveIntentContext(
      { transfer: initialTransfer, messages: safeMessages },
      { apiKey, graphConfig },
    ),
    retrieveTransactionPattern(
      { transfer: initialTransfer },
      { config: databaseConfig },
    ),
  ]);
  const safeTransfer = {
    ...initialTransfer,
    analysis_done: body.conversationState?.analysisDone === true,
    dialogue_plan: dialoguePlan(body.dialogue),
    pattern_risk_score: Math.max(
      Number(initialTransfer.pattern_risk_score) || 0,
      Number(transactionPattern.risk_score) || 0,
    ),
  };
  const retrieval = {
    ...ragRetrieval,
    transaction_pattern: transactionPattern,
  };

  let llm;
  try {
    llm = await extractIntent(safeTransfer, safeMessages, apiKey, retrieval);
  } catch (err) {
    const reason = /Gemini 429/.test(err.message) ? "quota"
                 : /Gemini 4/.test(err.message)   ? "auth"
                 : "unavailable";
    console.error(`[intent] Gemini 실패(${reason}) → 폴백:`, err.message.slice(0, 200));
    if (needsDamageResponse(situation)) {
      return {
        message: damageResponsePlan(situation).fallback,
        done: true, hold: true, risk: { score: HOLD_THRESHOLD, level: "HIGH", labels: ["피해 상황 확인"], codes: [] },
        intent: { purpose: "", requester: "", channel: "" }, situation,
        action: "damage_response", fallback: true, fallbackReason: reason,
      };
    }
    return {
      ...fallback({ turn, retrieval, safeTransfer, safeMessages }),
      fallbackReason: reason,
    };
  }

  llm = groundSensitiveLlmClaims(llm, safeMessages, safeTransfer);
  situation = resolveSituation(safeMessages, body.conversationState?.situation, llm.situation_facts);
  const isEmergency = needsDamageResponse(situation);
  const contradictions = normalizeStringList(llm.answer_contradictions);
  const hasConversationContradiction = contradictions.length > 0
    && safeMessages.filter((message) => message.role !== "ai").length >= 2;
  const observedSignals = [
    ...(Array.isArray(llm.signals) ? llm.signals : []),
    ...(Array.isArray(llm.ruleSignals) ? llm.ruleSignals : []),
    ...(safeTransfer.call_in_progress ? ["CALL_IN_PROGRESS"] : []),
    ...(hasConversationContradiction ? ["ANSWER_CONTRADICTION"] : []),
  ];
  const risk = applyForcedHold(
    scoreSignals(observedSignals, { patternRiskScore: safeTransfer.pattern_risk_score }),
    safeTransfer,
  );
  const fraudType = classifyFraudType({
    llm,
    signals: risk.codes,
    messages: safeMessages,
  });
  const officialContent = retrieveOfficialContent(fraudType.code);
  const analysis = buildAnalysis(llm, risk, fraudType, retrieval, officialContent);
  const outOfTurns = turn >= MAX_TURNS;

  // ── 긴급 피해 신고: 사용자가 직접 피해를 호소하면 즉시 대응한다 ──
  if (isEmergency) {
    const emergencyRisk = { ...risk, score: Math.max(risk.score, HOLD_THRESHOLD), level: "HIGH" };
    const latestUserText = [...safeMessages].reverse().find((message) => message.role !== "ai")?.text || "";
    const plan = damageResponsePlan(situation, latestUserText);
    plan.dialogueKind = safeTransfer.dialogue_plan.dialogueKind;
    plan.instruction += ` ${safeTransfer.dialogue_plan.instruction}`;
    const response = await personalizeResponse({
      mode: "damage", fallbackMessage: plan.fallback, requiredMessage: plan.actions.join("\n"),
      responsePlan: plan, safeTransfer, safeMessages, llm, risk: emergencyRisk, fraudType, retrieval, apiKey,
    });
    return {
      message: response.message,
      situation,
      action: "damage_response",
      hold: true,
      done: true,
      risk: emergencyRisk,
      intent: pickIntent(llm),
      analysis,
      fallback: false,
      responseFallback: response.fallback,
    };
  }

  // ── 판정: 규칙만이 결정한다 ──
  //
  // 위험이 확인됐어도 최소 질문 수를 채우기 전에는 결론을 내지 않는다.
  // 대신 무엇이 걱정되는지 지금 알려주고 한 단계 더 캐묻는다.
  // 송금은 이 동안에도 정지 상태이므로 지연으로 인한 위험 증가는 없다.
  // 명백한 고위험 신호가 이미 확인된 경우 같은 내용을 채우기식으로 더 묻지 않는다.
  // 첫 답변만으로 섣불리 끝내지는 않되, 두 번째 답변부터는 충분한 근거가 있으면 판정한다.
  const evidenceGapQuestion = selectEvidenceGapQuestion(llm, risk, safeMessages, safeTransfer);
  const minimumEvidenceTurnsReached = turn >= MIN_TURNS_BEFORE_VERDICT
    || (risk.level === "HIGH" && turn >= 2);
  const verdictReady = outOfTurns
    || (minimumEvidenceTurnsReached && !evidenceGapQuestion);

  if (risk.level !== "LOW" && risk.score > 0 && !verdictReady) {
    const probeQuestion = selectProbeQuestion(llm, risk, safeMessages, safeTransfer);
    const fallbackMessage = buildProbeMessage(risk, fraudType, llm, safeMessages, probeQuestion);
    const response = await personalizeResponse({
      mode: "probe", fallbackMessage, safeTransfer, safeMessages,
      requiredMessage: probeQuestion,
      llm, risk, fraudType, retrieval, apiKey,
    });
    return {
      message: response.message,
      hold: true,
      done: false,
      risk,
      intent: pickIntent(llm),
      analysis,
      fallback: false,
      responseFallback: response.fallback,
    };
  }

  if (risk.level === "HIGH" || ((llm.done || outOfTurns) && risk.score > 0)) {
    const fallbackMessage = buildRiskMessage(llm, risk, fraudType);
    const response = await personalizeResponse({
      mode: "risk", fallbackMessage, safeTransfer, safeMessages,
      requiredMessage: safeActionFor(fraudType.code, risk.codes),
      llm, risk, fraudType, retrieval, apiKey,
    });
    return {
      message: response.message,
      hold: true,
      done: true,
      risk,
      intent: pickIntent(llm),
      analysis,
      fallback: false,
      responseFallback: response.fallback,
    };
  }

  // 위험 점수가 있는데 LLM이 그만하자고 하면, 최소 질문 수까지는 계속 묻는다
  if (llm.done && risk.score > 0 && !verdictReady) {
    const probeQuestion = selectProbeQuestion(llm, risk, safeMessages, safeTransfer);
    const fallbackMessage = buildProbeMessage(risk, fraudType, llm, safeMessages, probeQuestion);
    const response = await personalizeResponse({
      mode: "probe", fallbackMessage, safeTransfer, safeMessages,
      requiredMessage: probeQuestion,
      llm, risk, fraudType, retrieval, apiKey,
    });
    return {
      message: response.message,
      hold: true,
      done: false,
      risk,
      intent: pickIntent(llm),
      analysis,
      fallback: false,
      responseFallback: response.fallback,
    };
  }

  if (llm.done || outOfTurns) {
    const response = await personalizeResponse({
      mode: "pass", fallbackMessage: PASS_MESSAGE, safeTransfer, safeMessages,
      requiredMessage: "현재 대화에서 확인된 위험 신호가 없으며 송금을 계속할 수 있다는 판정을 바꾸지 마세요.",
      llm, risk, fraudType, retrieval, apiKey,
    });
    return {
      message: response.message,
      hold: false,
      done: true,
      risk,
      intent: pickIntent(llm),
      analysis,
      fallback: false,
      responseFallback: response.fallback,
    };
  }

  const nextQuestion = llm.next_question || FALLBACK_QUESTIONS[0];
  const response = await personalizeResponse({
    mode:"probe",fallbackMessage:[llm.reply,nextQuestion].filter(Boolean).join("\n\n"),
    requiredMessage:nextQuestion,safeTransfer,safeMessages,llm,risk,fraudType,retrieval,apiKey,
  });
  return {
    message: response.message,
    hold: false,
    done: false,
    risk,
    intent: pickIntent(llm),
    analysis,
    fallback: false,
    responseFallback: response.fallback,
  };
}

async function personalizeResponse({
  mode, fallbackMessage, safeTransfer, safeMessages,
  requiredMessage = fallbackMessage,
  llm, risk, fraudType, retrieval, apiKey, responsePlan = {
    situation: resolveSituation(safeMessages),
    dialogueKind: safeTransfer.dialogue_plan?.dialogueKind,
    instruction: (safeTransfer.analysis_done
      ? "분석 완료 후의 후속 대화입니다. 지금 질문에 직접 답하고, 기존 위험 설명과 행동 목록을 반복하지 마세요."
      : "현재 질문과 새로 확인한 사실을 중심으로 설명하세요.") + ` ${safeTransfer.dialogue_plan?.instruction || ""}`,
  },
}) {
  try {
    const message = await generateUserResponse({
      mode,
      transfer: safeTransfer,
      messages: safeMessages,
      llm,
      risk,
      fraudType,
      retrieval,
      requiredMessage,
      responsePlan,
    }, apiKey);
    return { message, fallback: false };
  } catch (error) {
    console.warn(`[intent] 맞춤 답변 생성 실패 → 안전 문구 사용: ${error.message}`);
    return { message: fallbackMessage, fallback: true };
  }
}

const pickIntent = (llm) => ({
  purpose: llm.purpose || "",
  requester: llm.requester || "",
  channel: llm.channel || "",
});

/**
 * 근거 결합 뒤 남은 공백 중 판정에 가장 큰 영향을 주는 것 하나만 묻는다.
 * 결론을 미루는 것이지 위험을 숨기는 것이 아니므로, 걱정되는 점은 이 시점에 이미 전달한다.
 *
 * - RAG: 현재 대화와 유사 사기 수법을 비교할 요청자·접촉 경로·요구 행동
 * - 거래 패턴: 송금 화면에서 이미 아는 금액·신규 수취인·계좌 표시는 다시 묻지 않음
 * - 규칙 엔진: 앱 설치·인증정보 제공 등 대응 단계가 달라지는 사실을 우선 확인
 */
function selectEvidenceGapQuestion(llm = {}, risk = {}, messages = [], transfer = {}) {
  const asked = messages
    .filter((message) => message.role === "ai")
    .map((message) => message.text)
    .join("\n");
  const userText = messages
    .filter((message) => message.role !== "ai")
    .map((message) => message.text)
    .join(" ");
  const userTurnCount = messages.filter((message) => message.role !== "ai").length;
  const isKnown = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    return Boolean(normalized)
      && !["unknown", "none", "null", "미상", "알 수 없음", "확인되지 않음", "불명"].includes(normalized);
  };
  const requestedActions = normalizeStringList(llm.requested_actions).filter(isKnown);
  const codes = new Set(risk.codes || []);
  const requester = String(llm.requester || "").trim().toLowerCase();
  const requesterIsVague = /^(기관|은행|회사|그\s*사람|상대방)$/.test(requester);
  const channel = String(llm.channel || "").trim().toLowerCase();
  const isPhoneContact = /전화|통화|phone|call/.test(`${channel} ${userText}`);
  const hasRequester = isKnown(llm.requester)
    || /(검찰|경찰|금감원|금융감독원|국세청|구청|정부기관|은행|카드사|증권|보험|가족|아들|딸|손자|손녀|지인|친구|회사|업체|상담사|직원|수사관)/.test(userText);
  const hasChannel = isKnown(llm.channel)
    || /(전화|통화|문자|카카오톡|카톡|메신저|앱|웹|사이트|대면|직접 만)/.test(userText);
  const hasContactNumber = /<PHONE>|\[전화번호\]|0\d{1,2}[\s-]?\d{3,4}[\s-]?\d{4}|전화번호|번호는/.test(userText);
  const hasRecipientFromTransaction = transfer.recipient_display_type
    && transfer.recipient_display_type !== "확인되지 않음";
  const hasPurpose = isKnown(llm.purpose)
    || /(대출|투자|환급|당첨|보증금|수수료|세금|병원비|생활비|용돈|등록금|물건|계약금|안전\s*계좌|범죄.{0,8}연루)/.test(userText);
  const hasRequestedAction = requestedActions.length > 0
    || /(보내|송금|입금|이체|설치|깔|인증번호|비밀번호|신분증|링크|클릭|통화.{0,6}유지|말하지)/.test(userText);
  const compromiseState = resolveSituation(messages);
  const known = (...keys) => keys.some(key => compromiseState.facts[key]);

  // 이미 노출·설치·송금했는지는 4단계 피해 대응 여부를 바꾸므로 가장 먼저 확인한다.
  const safetyCritical = [
    (codes.has("CREDENTIAL_REQUEST") || codes.has("PERSONAL_DATA_REQUEST")) && !known("credential", "personal")
      && !/(이미.*알려|인증번호.*알려|개인정보.*제공)/.test(asked)
      ? "비밀번호나 인증번호를 이미 알려주셨나요?"
      : "",
    codes.has("APP_INSTALLATION_REQUEST") && !known("app")
      && !/(앱을 이미 설치|설치하셨)/.test(asked)
      ? "그 앱을 이미 설치하셨나요?"
      : "",
    codes.has("MALICIOUS_URL") && !known("link")
      && !/(링크를 이미|링크.*누르셨)/.test(asked)
      ? "그 링크를 이미 누르셨나요?"
      : "",
    codes.has("ADDITIONAL_PAYMENT_REQUEST") && !known("transfer")
      && !/(이전에.*돈|이미.*보냈|몇 번 보내)/.test(asked)
      ? "이전에 같은 이유로 돈을 보낸 적이 있나요?"
      : "",
  ].filter(Boolean);

  // RAG 사례와 비교할 핵심 축이다. 대화에서 확인되지 않은 항목만 후보로 둔다.
  const sourceAndIntent = [
    !hasRequester && !/(누가|어디에서|어느 곳|기관 이름)/.test(asked)
      ? "누가 돈을 보내라고 했나요?"
      : "",
    !hasChannel && !/(전화|문자|카카오톡|어떻게 연락)/.test(asked)
      ? "전화, 문자, 카카오톡 중 어떻게 연락해 왔나요?"
      : "",
    requesterIsVague && codes.has("AGENCY_IMPERSONATION")
      && !/(정확한 기관|기관의 정확한 이름)/.test(asked)
      ? "연락한 곳의 정확한 기관 이름은 무엇이었나요?"
      : "",
    isPhoneContact && !hasContactNumber && !/(어떤 전화번호|몇 번|연락처)/.test(asked)
      ? "어떤 전화번호로 연락이 왔나요?"
      : "",
    !hasRequestedAction && !/(무엇을 하라고|어떤 요구)/.test(asked)
      ? "그 사람이 정확히 무엇을 하라고 했나요?"
      : "",
    !hasPurpose && !/(어떤 이유|무슨 돈|송금 이유)/.test(asked)
      ? "그 사람이 돈을 보내야 하는 이유를 뭐라고 설명했나요?"
      : "",
    !hasRecipientFromTransaction && /(?:transfer|송금|입금|이체)/.test(requestedActions.join(" "))
      && !/(계좌|입금|송금|보내)/.test(userText) && !/(누구 이름의 계좌|계좌 주인)/.test(asked)
      ? "돈은 누구 이름의 계좌로 보내라고 했나요?"
      : "",
  ].filter(Boolean);

  // 위험 유형별로 사실 여부를 가르는 질문. 검색 근거는 질문 선택에만 쓰고 사실로 간주하지 않는다.
  const discriminators = [
    codes.has("CHANGED_FAMILY_CONTACT") && !/(평소.*번호|직접.*통화)/.test(`${asked} ${userText}`)
      ? "평소 쓰던 가족 번호로 직접 통화해 보셨나요?"
      : "",
    codes.has("PREPAY_CONTRADICTION") && !/(돈의 명목|무슨 명목|보증금|수수료|세금)/.test(`${asked} ${userText}`)
      ? "먼저 보내라는 돈은 무슨 명목이라고 했나요?"
      : "",
    codes.has("GUARANTEED_RETURN") && !/(어떻게 알게|유튜브|카카오톡|리딩방|소개)/.test(`${asked} ${userText}`)
      ? "그 투자처를 어디에서 처음 알게 되셨나요?"
      : "",
    codes.has("SECRECY_INSTRUCTION") && !/(왜.*말하지|비밀.*이유)/.test(`${asked} ${userText}`)
      ? "왜 가족이나 은행에 말하지 말라고 했나요?"
      : "",
    codes.has("URGENCY") && !/(언제까지|오늘까지|지금 당장|시간)/.test(`${asked} ${userText}`)
      ? "언제까지 보내야 한다고 했나요?"
      : "",
    codes.has("CALL_IN_PROGRESS") && !transfer.call_in_progress
      && !/(지금도.*통화|통화.*중)/.test(`${asked} ${userText}`)
      ? "지금도 그 사람과 통화 중이신가요?"
      : "",
  ].filter(Boolean);

  const candidates = [
    ...safetyCritical,
    // D등급이어도 첫 답변에서는 전화번호 등 확인 가치가 큰 정보 한 가지를 묻는다.
    // 두 번째 답변부터는 이런 보조 정보가 없어도 판정을 끝내되, 앱 설치·인증정보
    // 노출처럼 피해대응 단계가 달라지는 안전 핵심 질문은 위에서 계속 확인한다.
    ...(transfer.forced_hold && userTurnCount > 1 ? [] : sourceAndIntent),
    ...(transfer.forced_hold && userTurnCount > 1 ? [] : discriminators),
  ].filter(Boolean);

  return candidates.find((question) => !asked.includes(question)) || "";
}

export function selectProbeQuestion(llm = {}, risk = {}, messages = [], transfer = {}) {
  const asked = messages
    .filter((message) => message.role === "ai")
    .map((message) => message.text)
    .join("\n");
  const evidenceGap = selectEvidenceGapQuestion(llm, risk, messages, transfer);
  if (evidenceGap) return evidenceGap;
  if (llm.next_question && !asked.includes(llm.next_question)) return llm.next_question;
  return DEFAULT_PROBE;
}

function buildProbeMessage(risk, fraudType, llm, messages = [], preferredQuestion = "") {
  const aiMessages = messages.filter((m) => m.role === "ai");
  const asked = aiMessages.map((m) => m.text).join("\n");
  const userMessages = messages.filter((m) => m.role !== "ai");
  const lastUserMsg = userMessages.at(-1)?.text || "";
  const probeTurn = aiMessages.filter((m) => !m.text.includes("처음 보내는 계좌")).length;

  if (probeTurn === 0) {
    const topCode = risk.codes.find((code) => EASY_REASONS[code]);
    const concern = topCode
      ? EASY_REASONS[topCode]
      : compactExplanation(llm.explanation);
    const question = preferredQuestion || selectProbeQuestion(llm, risk, messages);
    return [
      "확인한 내용이에요",
      concern || "말씀하신 내용을 안전하게 확인하고 있어요.",
      "한 가지만 확인할게요",
      question,
    ].filter(Boolean).join("\n\n");
  }

  const reply = llm.reply?.trim();
  const FOLLOWUPS = [
    "한 가지만 더 확인할게요.",
    "안전을 위해 하나만 더 여쭤볼게요.",
    "마지막으로 확인할 게 있어요.",
  ];
  const fallbackOpener = FOLLOWUPS[Math.min(probeTurn - 1, FOLLOWUPS.length - 1)];
  const opener = sanitizeReply(reply, asked) || buildContextualOpener(lastUserMsg, llm) || fallbackOpener;

  const question = preferredQuestion || selectProbeQuestion(llm, risk, messages);

  const unusedConcern = risk.codes
    .filter((code) => EASY_REASONS[code] && !asked.includes(EASY_REASONS[code]))
    .map((code) => EASY_REASONS[code])[0];

  const explanation = llm.explanation?.trim();
  const newExplanation = explanation && !asked.includes(explanation)
    ? sanitizeReply(explanation, asked)
    : "";

  const concern = unusedConcern
    ? `추가로 확인된 점이에요.\n${unusedConcern}`
    : (newExplanation ? newExplanation : "");

  return [
    "확인한 내용이에요",
    [opener, concern].filter(Boolean).join("\n"),
    "한 가지만 확인할게요",
    question,
  ].filter(Boolean).join("\n\n");
}


function sanitizeReply(text, alreadySaid = "") {
  if (!text) return "";
  let cleaned = text.replace(/\s{2,}/g, " ").trim();
  if (cleaned.length < 5) return "";
  if (alreadySaid.includes(cleaned)) return "";
  return cleaned;
}

function buildContextualOpener(lastUserMsg, llm) {
  if (!lastUserMsg) return "";
  const purpose = llm.purpose?.trim();
  const requester = llm.requester?.trim();
  const channel = llm.channel?.trim();
  if (requester && channel) return `${requester}에게 ${channel}으로 연락받으셨군요.`;
  if (purpose) return `${purpose} 때문에 보내시는 거군요.`;
  if (requester) return `${requester}이(가) 보내라고 했군요.`;
  if (lastUserMsg.length < 30) return `"${lastUserMsg.slice(0, 20)}" — 알겠어요.`;
  return "";
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
  const has = (code) => signalCodes.includes(code);
  let verifyStep = "은행 앱에서 공식 고객센터 번호를 찾아 직접 전화하세요.";
  let protectStep = "상대방 전화번호를 인터넷에 검색해 사기 신고 이력을 확인하세요.";

  // 사기 유형별로 가장 중요한 행동 두 개만 고른다. 마지막 답변의 행동 항목은 항상 4개로 유지한다.
  if (fraudType === "family_or_acquaintance_impersonation" || has("CHANGED_FAMILY_CONTACT")) {
    verifyStep = "새 번호가 아닌 평소 알고 있던 가족 번호로 직접 전화하세요.";
    protectStep = "연결되지 않으면 다른 가족에게 확인하고, 새 번호의 송금 요구에는 응답하지 마세요.";
  } else if (fraudType === "institution_impersonation") {
    verifyStep = "상대가 알려준 번호가 아닌 은행 앱·기관 홈페이지의 공식 번호로 직접 전화하세요.";
    protectStep = "'안전계좌'나 개인 명의 계좌로 옮기라는 요구에는 응답하지 마세요.";
  } else if (fraudType === "loan_advance_fee") {
    verifyStep = "해당 금융사의 공식 앱이나 고객센터에서 대출 상품과 담당자를 확인하세요.";
    protectStep = "보증금·수수료·기존 대출 상환 명목의 선입금 요구에는 응답하지 마세요.";
  } else if (fraudType === "refund_advance_fee") {
    verifyStep = "정부24 또는 해당 기관의 공식 홈페이지·고객센터에서 직접 확인하세요.";
    protectStep = "환급금·당첨금을 받기 위한 세금이나 수수료를 먼저 보내지 마세요.";
  } else if (fraudType === "investment_fraud") {
    verifyStep = "금융감독원 금융소비자정보포털에서 정식 등록 업체인지 확인하세요.";
    protectStep = "원금·고수익 보장이나 출금을 위한 추가 입금 요구에는 응답하지 마세요.";
  } else if (fraudType === "job_or_mission_fraud") {
    verifyStep = "업체명과 모집 공고를 공식 홈페이지에서 확인하고 사업자 정보를 조회하세요.";
    protectStep = "미션 완료나 출금을 위한 추가 입금을 중단하고 대화·송금 내역을 보관하세요.";
  } else if (fraudType === "smishing" || has("MALICIOUS_URL") || has("SMS_LURE")) {
    verifyStep = "문자의 링크를 다시 누르지 말고 해당 기관의 공식 앱에서 내용을 확인하세요.";
    protectStep = "링크를 눌렀거나 앱이 설치됐다면 네트워크를 끄고 118에 상담하세요.";
  } else if (fraudType === "malicious_app" || has("APP_INSTALLATION_REQUEST")) {
    verifyStep = "상대가 알려준 앱을 실행하지 말고 은행 공식 고객센터에 확인하세요.";
    protectStep = "앱을 설치했다면 네트워크를 끄고 다른 안전한 기기에서 비밀번호를 변경하세요.";
  } else if (fraudType === "personal_information_phishing") {
    verifyStep = "은행 공식 고객센터에 개인정보 노출 사실을 알리고 계좌 상태를 확인하세요.";
    protectStep = "개인정보 노출자 사고예방 시스템에 등록하고 비밀번호를 변경하세요.";
  }

  const stopStep = has("CALL_IN_PROGRESS")
    ? "송금하지 말고 상대방과의 통화를 먼저 끊으세요."
    : "지금은 송금하지 말고 상대방과의 연락을 멈추세요.";
  const reportStep = has("CREDENTIAL_REQUEST")
    ? "비밀번호·인증번호를 알려줬다면 즉시 변경하고, 경찰청 112 또는 금감원 1332에 신고하세요."
    : "대화·문자·전화번호·계좌번호를 보관하고, 경찰청 112 또는 금감원 1332에 신고하세요.";
  const steps = [stopStep, verifyStep, protectStep, reportStep];

  const header = "지금 해야 할 일이에요";
  const numbered = steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
  return `${header}\n${numbered}`;
}

function softenExplanation(value = "") {
  return String(value)
    .replace(/100%\s*([^.!?]*?)사기입니다/gi, "$1사기일 가능성이 매우 높습니다")
    .replace(/확실한\s*사기(?:입니다|예요)/g, "사기일 가능성이 매우 높습니다")
    .replace(/반드시\s*사기(?:입니다|예요)/g, "사기일 가능성이 매우 높습니다");
}

function compactExplanation(value = "") {
  const softened = softenExplanation(value)
    .replace(/\s+/g, " ")
    .trim();
  if (!softened || softened.length < 5) return "말씀하신 내용에 위험한 점이 있어 다시 확인해야 해요.";
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
    title: record.title,
    publisher: record.publisher,
    page: record.page,
    source_url: record.source_url,
  }));
  const evidenceById = new Map(
    [...(retrieval.fraud || []), ...(retrieval.normal || []), ...(retrieval.official || [])]
      .map((record) => [record.id, record]),
  );
  const groundedEvidence = normalizeStringList(llm.grounding_evidence_ids)
    .filter((id) => evidenceById.has(id))
    .slice(0, 3)
    .map((id) => publicEvidence([evidenceById.get(id)])[0]);
  return {
    version: "intent-analysis-v3",
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
      official_document_evidence: publicEvidence(retrieval.official || []),
      grounded_evidence: groundedEvidence,
      transaction_pattern: {
        status: retrieval.transaction_pattern?.status || "disabled",
        method: retrieval.transaction_pattern?.method || "supabase_parameterized_sql",
        user_id: retrieval.transaction_pattern?.user_id || safeUserId(retrieval.transaction_pattern),
        lookback_months: retrieval.transaction_pattern?.lookback_months || 12,
        outgoing_count: Number(retrieval.transaction_pattern?.outgoing_count) || 0,
        transfer_count: Number(retrieval.transaction_pattern?.transfer_count) || 0,
        average_transfer_amount: Number(retrieval.transaction_pattern?.average_transfer_amount) || 0,
        maximum_transfer_amount: Number(retrieval.transaction_pattern?.maximum_transfer_amount) || 0,
        recipient_transfer_count: Number(retrieval.transaction_pattern?.recipient_transfer_count) || 0,
        recipient_known: Boolean(retrieval.transaction_pattern?.recipient_known),
        typical_transfer_hour: Number(retrieval.transaction_pattern?.typical_transfer_hour) || 0,
        risk_score: Number(retrieval.transaction_pattern?.risk_score) || 0,
        risk_reasons: normalizeStringList(retrieval.transaction_pattern?.risk_reasons),
        reason: retrieval.transaction_pattern?.reason || "",
      },
      knowledge_graph: {
        status: retrieval.graph?.status || "disabled",
        method: retrieval.graph?.method || "neo4j_fixed_cypher",
        paths: (retrieval.graph?.paths || []).map((path) => ({
          fraud_type_code: path.fraud_type_code,
          fraud_type_label: path.fraud_type_label,
          score: path.score,
          matched_signal_codes: path.matched_signal_codes,
          matched_channel_codes: path.matched_channel_codes,
          matched_impersonator_codes: path.matched_impersonator_codes,
          matched_action_codes: path.matched_action_codes,
          steps: path.steps,
        })),
      },
    },
    score_components: risk.components,
    official_content: officialContent,
  };
}

function safeUserId(pattern = {}) {
  const value = String(pattern?.user_id || "");
  return /^demo-parent-0[1-3]$/.test(value) ? value : "demo-parent-01";
}

/** LLM 장애 시에도 명시적인 위험 표현은 같은 규칙 엔진으로 판정한다. */
function fallback({
  turn,
  retrieval = { method: "none", fraud: [], normal: [], official: [] },
  safeTransfer = {},
  safeMessages = [],
}) {
  const localContradictions = extractRuleContradictions(safeMessages);
  const localSignals = [
    ...extractRuleSignals(safeMessages, safeTransfer),
    ...(localContradictions.length ? ["ANSWER_CONTRADICTION"] : []),
  ];
  const risk = applyForcedHold(
    scoreSignals(localSignals, { patternRiskScore: safeTransfer.pattern_risk_score }),
    safeTransfer,
  );
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
  const fallbackEvidenceGap = selectEvidenceGapQuestion(localLlm, risk, safeMessages, safeTransfer);

  if (risk.level === "HIGH" && turn < MAX_TURNS && (turn < 2 || fallbackEvidenceGap)) {
    const probeQuestion = fallbackEvidenceGap
      || selectProbeQuestion(localLlm, risk, safeMessages, safeTransfer);
    return {
      message: buildProbeMessage(risk, fraudType, localLlm, safeMessages, probeQuestion),
      hold: true,
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
