// 공식 기관 연락 채널 화이트리스트 — 기관사칭형 보이스피싱(2025년 1분기 51%, README 참고)을
// 막는 핵심 자료. "은행이라고 문자가 왔는데, 그 번호가 진짜 은행 번호인가?"를 판정한다.
// 데이터는 shared/official-contacts.json 하나로 관리한다 — 프론트(Verify.tsx·callscreen.ts)와
// 여기가 서로 다른 목록을 보면 "검증 화면에서는 안전했는데 송금할 땐 못 알아본다" 같은
// 자기모순이 생긴다.

import officialContacts from "../../../../shared/official-contacts.json" with { type: "json" };

export const OFFICIAL_CONTACTS = Object.freeze([
  ...officialContacts.phones.map((p) => Object.freeze({ name: p.name, type: "phone", value: p.value })),
  ...officialContacts.domains.map((d) => Object.freeze({ name: d.name, type: "domain", value: d.value })),
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
