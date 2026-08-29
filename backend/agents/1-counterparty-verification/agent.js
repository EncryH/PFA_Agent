import { AGENT_STATUS } from "../shared.js";
import { matchWhitelist } from "./rules/whitelist.js";
import { matchBlacklist } from "./rules/blacklist.js";

export const metadata = Object.freeze({
  layer: 1,
  key: "counterparty-verification",
  name: "상대방 검증",
  status: AGENT_STATUS.READY,
});

/**
 * 수취 계좌·전화번호·도메인을 화이트리스트(공식 기관)·블랙리스트(더치트 신고 이력)와 대조한다.
 *
 * 결론이 분명하면(화이트리스트 일치 → PASS, 블랙리스트 일치 → BLOCK) 그 자리에서 확정하고
 * 이후 계층(2·3층)을 부르지 않는다 — 3층의 "0점이면 이후 계층을 실행하지 않는다"는 무마찰
 * 원칙을 1층에도 그대로 적용한 것이다. 어느 쪽에도 없으면 CONTINUE 로 넘기되, "미확인 상대"라는
 * 약한 신호만 얹어서 2·3층이 계속 판단하게 한다.
 *
 * 규칙 기반이며 LLM을 쓰지 않는다. 점수만 반환하고 최종 등급 판정은 오케스트레이터가 한다.
 */
export function runCounterpartyVerificationAgent({ account = "", phone = "", domain = "" } = {}) {
  const whitelistHit = matchWhitelist({ phone, domain });
  if (whitelistHit) {
    return {
      agent: metadata.key, layer: metadata.layer, evaluated: true,
      decision: "PASS", score: 0, isKnownRecipient: true,
      reasons: [`공식 채널 확인됨 — ${whitelistHit.name}`],
    };
  }

  const blacklistHit = matchBlacklist(account) ?? matchBlacklist(phone) ?? matchBlacklist(domain);
  if (blacklistHit) {
    return {
      agent: metadata.key, layer: metadata.layer, evaluated: true,
      decision: "BLOCK", score: 100, isKnownRecipient: false,
      reasons: [`더치트 신고 이력 ${blacklistHit.reportCount}건 — ${blacklistHit.scamTypes.join(", ")}`],
      thecheat: blacklistHit,
    };
  }

  return {
    agent: metadata.key, layer: metadata.layer, evaluated: true,
    decision: "CONTINUE", score: 10, isKnownRecipient: false,
    reasons: ["화이트리스트·신고 이력 어디에도 없는 미확인 상대"],
  };
}
