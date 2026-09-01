import { AGENT_STATUS } from "../shared.js";
import { matchWhitelist } from "./rules/whitelist.js";
import { matchBlacklist } from "./rules/blacklist.js";
import { matchImpersonation } from "./rules/impersonation.js";

export const metadata = Object.freeze({
  layer: 1,
  key: "counterparty-verification",
  name: "상대방 검증",
  status: AGENT_STATUS.READY,
});

// 4층(rules/signals.js)과 같은 형태의 신호 카탈로그. CONTINUE로 넘어갈 때 붙는 점수는
// 여기서만 온다 — PASS·BLOCK은 이 카탈로그를 쓰지 않고 즉시 확정한다.
export const SIGNALS = Object.freeze({
  IMPERSONATION_SUSPECTED: {
    score: 30,
    label: (brand) => `${brand} 이름을 사칭한 것으로 보이는 연락처 — 공식 채널 아님`,
  },
});

export const SIGNAL_CODES = Object.keys(SIGNALS);

/**
 * 수취 계좌·전화번호·도메인을 3단계로 검사한다.
 *
 *   1) 화이트리스트(공식 기관 번호·도메인) 일치 → PASS, 점수 0, 즉시 확정
 *   2) 블랙리스트(더치트 신고 이력) 일치        → BLOCK, 점수 100, 즉시 확정
 *   3) 어느 쪽도 아니면 CONTINUE — 이때 기관 이름 사칭 패턴(IMPERSONATION_SUSPECTED)이
 *      감지되면 그 점수만 얹는다. "미등록 수취인" 자체는 점수를 안 준다 — 3층(거래 검사)이
 *      이미 그 사실에 채점하므로, 여기서 또 매기면 같은 사실에 이중 페널티가 된다.
 *
 * PASS/BLOCK 은 2·3층을 부르지 않는다 — 3층의 "0점이면 이후 계층을 실행하지 않는다"는
 * 무마찰 원칙을 1층에도 그대로 적용한 것이다.
 *
 * isKnownRecipient 힌트: 호출자(프론트의 저장된 수취인 목록 등)가 이미 아는 상대라고
 * 알려주면 그 사실을 그대로 인정한다 — 공식 화이트리스트에 없다고 해서 다시 "미확인
 * 상대" 취급하지 않는다.
 *
 * 규칙 기반이며 LLM을 쓰지 않는다. 점수만 반환하고 최종 등급 판정은 오케스트레이터가 한다.
 */
export function runCounterpartyVerificationAgent({
  account = "", phone = "", domain = "", isKnownRecipient = false,
} = {}) {
  const whitelistHit = matchWhitelist({ phone, domain });
  if (whitelistHit) {
    return {
      agent: metadata.key, layer: metadata.layer, evaluated: true,
      decision: "PASS", score: 0, isKnownRecipient: true, codes: [],
      reasons: [`공식 채널 확인됨 — ${whitelistHit.name}`],
    };
  }

  const blacklistHit = matchBlacklist(account) ?? matchBlacklist(phone) ?? matchBlacklist(domain);
  if (blacklistHit) {
    return {
      agent: metadata.key, layer: metadata.layer, evaluated: true,
      decision: "BLOCK", score: 100, isKnownRecipient: false, codes: [],
      reasons: [`더치트 신고 이력 ${blacklistHit.reportCount}건 — ${blacklistHit.scamTypes.join(", ")}`],
      thecheat: blacklistHit,
    };
  }

  const codes = [];
  const reasons = [];
  let score = 0;

  const impersonationHit = matchImpersonation({ phone, domain });
  if (impersonationHit) {
    codes.push("IMPERSONATION_SUSPECTED");
    score += SIGNALS.IMPERSONATION_SUSPECTED.score;
    reasons.push(SIGNALS.IMPERSONATION_SUSPECTED.label(impersonationHit.brand));
  }

  if (!isKnownRecipient) {
    reasons.push("화이트리스트·신고 이력 어디에도 없는 미확인 상대");
  }

  return {
    agent: metadata.key, layer: metadata.layer, evaluated: true,
    decision: "CONTINUE", score, isKnownRecipient: !!isKnownRecipient, codes,
    reasons,
  };
}
