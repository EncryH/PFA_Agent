// 공식 기관 연락 채널 화이트리스트 — 기관사칭형 보이스피싱(2025년 1분기 51%, README 참고)을
// 막는 핵심 자료. "은행이라고 문자가 왔는데, 그 번호가 진짜 은행 번호인가?"를 판정한다.
// 골든타임(6층) 화면에서 안내하는 번호와 반드시 같은 값을 써야 한다 — 서로 다르면
// "우리 앱이 알려준 번호가 우리 앱 스스로도 못 알아보는" 자기모순이 생긴다.

export const OFFICIAL_CONTACTS = Object.freeze([
  { name: "한결은행 고객센터", type: "phone",  value: "1588-5000" },
  { name: "나눔은행 고객센터", type: "phone",  value: "1588-9000" },
  { name: "경찰청 (112)",      type: "phone",  value: "112" },
  { name: "금융감독원 (1332)", type: "phone",  value: "1332" },
  { name: "서민금융진흥원",    type: "phone",  value: "1397" },
  { name: "한결은행",          type: "domain", value: "hangyeol-bank.co.kr" },
  { name: "나눔은행",          type: "domain", value: "nanum-bank.co.kr" },
  { name: "금융감독원",        type: "domain", value: "fss.or.kr" },
  { name: "정부24",            type: "domain", value: "gov.kr" },
]);

const normalizePhone = (v) => String(v ?? "").replace(/[-\s]/g, "");

/**
 * 전화번호는 정확히 일치할 때만, 도메인은 공식 도메인으로 끝날 때만(서브도메인 허용) 통과시킨다.
 * "은행 이름이 URL에 들어있다"만으로는 안전 판정하지 않는다 — 그게 바로
 * kb-safe.com, shinhan-auth.net 같은 사칭 도메인들의 수법이기 때문이다.
 */
export function matchWhitelist({ phone = "", domain = "" } = {}) {
  const cleanPhone = normalizePhone(phone);
  if (cleanPhone) {
    const hit = OFFICIAL_CONTACTS.find((c) => c.type === "phone" && normalizePhone(c.value) === cleanPhone);
    if (hit) return hit;
  }

  const cleanDomain = String(domain ?? "").trim().toLowerCase();
  if (cleanDomain) {
    const hit = OFFICIAL_CONTACTS.find(
      (c) => c.type === "domain" && (cleanDomain === c.value || cleanDomain.endsWith(`.${c.value}`)),
    );
    if (hit) return hit;
  }

  return null;
}
