// 더치트 mock 데이터 + 조회 함수.
// 실제 더치트 API는 기관 발급 전용이므로 MVP용 임의 데이터셋으로 대체한다.
// 프론트 Verify.tsx(/api/thecheat/check)와 여기(1층 상대방 검증)가 같은 데이터를 봐야
// "검증 화면에서는 안전했는데 송금할 땐 막혔다" 같은 불일치가 안 생긴다.

export const BLACKLIST = Object.freeze({
  "01012345678": { reportCount: 14, scamTypes: ["기관사칭", "보이스피싱"], lastReported: "2025-11-03" },
  "01098765432": { reportCount: 6,  scamTypes: ["대출사기"],              lastReported: "2025-10-28" },
  "07012341234": { reportCount: 29, scamTypes: ["보이스피싱", "기관사칭"], lastReported: "2025-11-15" },
  "01055556666": { reportCount: 3,  scamTypes: ["스미싱"],                lastReported: "2025-09-14" },
  "01099990000": { reportCount: 11, scamTypes: ["투자사기"],              lastReported: "2025-11-01" },
  "1104421783":  { reportCount: 7,  scamTypes: ["보이스피싱"],            lastReported: "2025-10-10" },
  "15660000":    { reportCount: 2,  scamTypes: ["기관사칭"],              lastReported: "2025-08-22" },
  "kb-safe.com":      { reportCount: 31, scamTypes: ["피싱사이트"],       lastReported: "2025-11-20" },
  "shinhan-auth.net": { reportCount: 18, scamTypes: ["피싱사이트"],       lastReported: "2025-11-12" },
  "hana-secure.co":   { reportCount: 9,  scamTypes: ["피싱사이트"],       lastReported: "2025-10-30" },
  "woori-verify.com": { reportCount: 24, scamTypes: ["피싱사이트"],       lastReported: "2025-11-18" },
  "bank-confirm.net": { reportCount: 15, scamTypes: ["피싱사이트", "스미싱"], lastReported: "2025-11-05" },
  "secure-login.kr":  { reportCount: 42, scamTypes: ["피싱사이트"],       lastReported: "2025-11-22" },
  "kbstar-verify.com":{ reportCount: 8,  scamTypes: ["피싱사이트"],       lastReported: "2025-10-15" },
});

/**
 * 계좌번호·전화번호·도메인 아무 문자열이나 넣으면 신고 이력을 찾아준다.
 * 숫자면 6자리 이상일 때만(짧은 입력 오탐 방지), 도메인이면 점(.)이 있을 때만 매칭한다.
 */
export function matchBlacklist(query) {
  if (!query) return null;
  const clean = String(query).replace(/[-\s]/g, "");

  if (/^\d+$/.test(clean) && clean.length >= 6) {
    return BLACKLIST[clean] ?? null;
  }
  if (String(query).includes(".")) {
    const lower = String(query).toLowerCase();
    for (const [k, v] of Object.entries(BLACKLIST)) {
      if (k.includes(".") && lower.includes(k)) return { ...v, matchedKey: k };
    }
  }
  return null;
}
