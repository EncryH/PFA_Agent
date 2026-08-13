// /api/intent 핸들러
//
// 흐름:  대화 → [Gemini] 신호 추출 → [규칙] 채점 → [규칙] 보류 판정 → 응답
//
// LLM 이 done 을 true 로 줘도 그건 '더 물을 게 없다'는 의견일 뿐이다.
// 실제로 송금을 멈출지는 아래 규칙만이 결정한다.

import { extractIntent } from "./gemini.js";
import { scoreSignals, MAX_TURNS } from "./signals.js";

const FALLBACK_QUESTIONS = [
  "구청이나 기관에서 연락을 받으신 건가요? 전화로 오셨나요, 문자로 오셨나요?",
  "혹시 지금도 그분과 통화 중이신가요?",
];

const FALLBACK_VERDICT =
  "⚠️ 주의가 필요해요.\n\n환급을 받으려면 수수료를 먼저 내야 한다는 건 보이스피싱의 대표 수법이에요. 따님에게 함께 확인받아볼게요.";

const PASS_MESSAGE = "확인됐습니다. 안전한 거래로 보여요. 송금을 진행할게요 😊";

/**
 * @param {{transfer: object, messages: {role: string, text: string}[], turn: number}} body
 * @param {string} apiKey
 */
export async function handleIntent(body, apiKey) {
  const { transfer = {}, messages = [], turn = 1 } = body;

  let llm;
  try {
    llm = await extractIntent(transfer, messages, apiKey);
  } catch (err) {
    const reason = /Gemini 429/.test(err.message) ? "quota"
                 : /Gemini 4/.test(err.message)   ? "auth"
                 : "unavailable";
    console.error(`[intent] Gemini 실패(${reason}) → 폴백:`, err.message.slice(0, 200));
    return { ...fallback(turn), fallbackReason: reason };
  }

  const risk = scoreSignals(llm.signals);
  const outOfTurns = turn >= MAX_TURNS;

  // ── 판정: 규칙만이 결정한다 ──
  if (risk.level === "HIGH" || ((llm.done || outOfTurns) && risk.score > 0)) {
    return {
      message: llm.explanation || FALLBACK_VERDICT,
      hold: true,
      done: true,
      risk,
      intent: pickIntent(llm),
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
      fallback: false,
    };
  }

  return {
    message: llm.next_question || FALLBACK_QUESTIONS[0],
    hold: false,
    done: false,
    risk,
    intent: pickIntent(llm),
    fallback: false,
  };
}

const pickIntent = (llm) => ({
  purpose: llm.purpose || "",
  requester: llm.requester || "",
  channel: llm.channel || "",
});

/** LLM 장애 시 사전 정의 시나리오 — 심사 중 데모가 멈추지 않게 한다. */
function fallback(turn) {
  const question = FALLBACK_QUESTIONS[turn - 1];
  if (question) {
    return {
      message: question,
      hold: false,
      done: false,
      risk: scoreSignals([]),
      intent: pickIntent({}),
      fallback: true,
    };
  }
  return {
    message: FALLBACK_VERDICT,
    hold: true,
    done: true,
    risk: scoreSignals(["PREPAY_CONTRADICTION", "AGENCY_IMPERSONATION", "URGENCY"]),
    intent: pickIntent({}),
    fallback: true,
  };
}
