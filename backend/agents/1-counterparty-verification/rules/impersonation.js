// 기관 사칭 이름 탐지 — 블랙리스트(rules/blacklist.js)는 "이미 신고된" 계좌·도메인만 잡는다.
// 하지만 README 통계처럼 기관사칭형이 2025년 1분기 51%까지 급증했고, 신고가 아직 안 쌓인
// "신생" 사칭 도메인도 있다. 이 규칙은 공식 기관 이름을 흉내낸 도메인·전화번호 패턴을
// 화이트리스트 실패 시점에 한 번 더 걸러낸다 (예: kb-safe.com, hangyeol-secure.net).
//
// 확정 판정이 아니라 "의심"이므로 블랙리스트처럼 즉시 BLOCK 하지 않는다 — 실제로 이름이
// 겹치는 무관한 개인·업체일 가능성이 있어서다. agent.js 가 CONTINUE 로 넘기되 점수를 얹는다.

export const BRAND_KEYWORDS = Object.freeze([
  { brand: "한결은행",   keywords: ["한결", "hangyeol"] },
  { brand: "나눔은행",   keywords: ["나눔", "nanum"] },
  { brand: "금융감독원", keywords: ["금감원", "fss", "금융감독"] },
  { brand: "경찰청",     keywords: ["경찰", "police"] },
  { brand: "서민금융진흥원", keywords: ["서민금융", "햇살론"] },
]);

/**
 * 화이트리스트에 없는(=정식 채널이 아닌 걸로 이미 확인된) phone·domain 이
 * 공식 기관 이름 키워드를 포함하면 사칭 의심으로 본다.
 */
export function matchImpersonation({ phone = "", domain = "" } = {}) {
  const target = `${phone} ${domain}`.toLowerCase().trim();
  if (!target) return null;

  const hit = BRAND_KEYWORDS.find(({ keywords }) =>
    keywords.some((k) => target.includes(k.toLowerCase())),
  );
  return hit ? { brand: hit.brand } : null;
}
