// 더치트 mock 데이터 + 조회 함수.
// 실제 더치트 API는 기관 발급 전용이므로 MVP용 임의 데이터셋으로 대체한다.
// Vite dev 프록시(frontend/vite.config.ts)와 Vercel 서버리스 함수(frontend/api/thecheat/check.js)
// 양쪽에서 이 모듈 하나를 그대로 가져다 쓴다 — 데이터가 두 곳에서 따로 관리되며 어긋나는 걸 막기 위해서다.

export const THECHEAT_BLACKLIST = {
  "01012345678": { reportCount: 14, scamTypes: ["기관사칭", "보이스피싱"], lastReported: "2025-11-03" },
  "01098765432": { reportCount: 6,  scamTypes: ["대출사기"],              lastReported: "2025-10-28" },
  "07012341234": { reportCount: 29, scamTypes: ["보이스피싱", "기관사칭"], lastReported: "2025-11-15" },
  "01055556666": { reportCount: 3,  scamTypes: ["스미싱"],                lastReported: "2025-09-14" },
  "01099990000": { reportCount: 11, scamTypes: ["투자사기"],              lastReported: "2025-11-01" },
  "1104421783":  { reportCount: 7,  scamTypes: ["보이스피싱"],            lastReported: "2025-10-10" },
  "1566XXXX":    { reportCount: 2,  scamTypes: ["기관사칭"],              lastReported: "2025-08-22" },
  "kb-safe.com":      { reportCount: 31, scamTypes: ["피싱사이트"],       lastReported: "2025-11-20" },
  "shinhan-auth.net": { reportCount: 18, scamTypes: ["피싱사이트"],       lastReported: "2025-11-12" },
  "hana-secure.co":   { reportCount: 9,  scamTypes: ["피싱사이트"],       lastReported: "2025-10-30" },
  "woori-verify.com": { reportCount: 24, scamTypes: ["피싱사이트"],       lastReported: "2025-11-18" },
  "bank-confirm.net": { reportCount: 15, scamTypes: ["피싱사이트", "스미싱"], lastReported: "2025-11-05" },
  "secure-login.kr":  { reportCount: 42, scamTypes: ["피싱사이트"],       lastReported: "2025-11-22" },
  "kbstar-verify.com":{ reportCount: 8,  scamTypes: ["피싱사이트"],       lastReported: "2025-10-15" },
};

export function lookupThecheat(query) {
  const clean = query.replace(/[-\s]/g, "");
  // 숫자번호: 6자리 이상일 때만 매칭 (짧은 입력의 오탐 방지)
  if (/^\d+$/.test(clean) && clean.length >= 6) {
    return THECHEAT_BLACKLIST[clean] ?? null;
  }
  // 도메인: 점(.)이 포함된 경우에만 매칭
  if (query.includes(".")) {
    const lower = query.toLowerCase();
    for (const [k, v] of Object.entries(THECHEAT_BLACKLIST)) {
      if (k.includes(".") && lower.includes(k)) return v;
    }
  }
  return null;
}
