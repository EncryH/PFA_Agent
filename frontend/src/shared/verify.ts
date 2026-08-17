// 상대방 검증 — 전화번호 / URL / 기관명 검증 로직

export interface VerifyResult {
  status: "safe" | "caution" | "danger" | "unknown";
  label: string;
  detail: string;
  thecheat?: TheCheAtResult | null;
}

export interface TheCheAtResult {
  found: boolean;
  reportCount: number;
  scamTypes: string[];
  lastReported: string;
}

// ─── 공식 번호 화이트리스트 ───────────────────────────────────────────────
export const OFFICIAL_PHONES: Record<string, string> = {
  "15881688": "KB국민은행",
  "15444000": "신한은행",
  "16448000": "우리은행",
  "15990000": "하나은행",
  "18991111": "NH농협은행",
  "15999999": "IBK기업은행",
  "15991500": "카카오뱅크",
  "11001001": "금융감독원",
  "18335500": "금융위원회",
  "15884321": "경찰청 112",
};

// 공식 정부·감독·공공기관 화이트리스트 (FSC API에 없는 기관 포함)
export const OFFICIAL_GOV_BODIES: Record<string, string> = {
  // 금융 감독·정책
  "금융감독원":     "금융감독원 (FSS) — 금융기관 감독 정부기관",
  "금융위원회":     "금융위원회 (FSC) — 금융정책 최고 의결기관",
  "금융정보분석원": "금융정보분석원 (KoFIU) — 자금세탁방지 정부기관",
  "금융결제원":     "금융결제원 (KFTC) — 금융전산망 운영 공공기관",
  "금융보안원":     "금융보안원 (FSI) — 금융 사이버보안 전문기관",
  // 중앙은행·정책금융
  "한국은행":         "한국은행 (BOK) — 중앙은행",
  "한국산업은행":     "한국산업은행 (KDB) — 정책금융 국책은행",
  "한국수출입은행":   "한국수출입은행 (KEXIM) — 정책금융 국책은행",
  // 예금·보증
  "예금보험공사":   "예금보험공사 (KDIC) — 예금 보호 공공기관",
  "신용보증기금":   "신용보증기금 (KODIT) — 중소기업 신용보증 공공기관",
  "기술보증기금":   "기술보증기금 (KIBO) — 기술기업 보증 공공기관",
  "서민금융진흥원": "서민금융진흥원 — 서민금융 지원 공공기관",
  // 자본시장
  "한국거래소":         "한국거래소 (KRX) — 증권·파생상품 거래소",
  "한국예탁결제원":     "한국예탁결제원 (KSD) — 증권 예탁·결제 공공기관",
  "한국주택금융공사":   "한국주택금융공사 (HF) — 주택금융 공공기관",
  "한국자산관리공사":   "한국자산관리공사 (KAMCO) — 부실채권 정리 공공기관",
  "한국신용정보원":     "한국신용정보원 (KCIS) — 신용정보 공공기관",
  // 사회보험·연금
  "국민건강보험공단": "국민건강보험공단 (NHIS) — 건강보험 운영 공공기관",
  "국민연금공단":     "국민연금공단 (NPS) — 국민연금 운영 공공기관",
  "근로복지공단":     "근로복지공단 (KCOMWEL) — 산재·고용보험 공공기관",
  "공무원연금공단":   "공무원연금공단 — 공무원 연금 공공기관",
  "사학연금공단":     "사학연금공단 — 사립학교 연금 공공기관",
  // 정부기관
  "경찰청":           "대한민국 경찰청 — 정부기관",
  "검찰청":           "대한민국 검찰청 — 정부기관",
  "국세청":           "국세청 (NTS) — 세금 징수 정부기관",
  "관세청":           "관세청 — 수출입 관세 정부기관",
  "행정안전부":       "행정안전부 — 정부기관",
  "법무부":           "법무부 — 정부기관",
  "금융위":           "금융위원회 (FSC) — 금융정책 최고 의결기관",
  // ICT·소비자
  "한국인터넷진흥원": "한국인터넷진흥원 (KISA) — 인터넷·사이버보안 전문기관",
  "개인정보보호위원회": "개인정보보호위원회 (PIPC) — 개인정보 감독 정부기관",
  "방송통신위원회":   "방송통신위원회 (KCC) — 방송·통신 규제 정부기관",
  "과학기술정보통신부": "과학기술정보통신부 — 정부기관",
  "한국소비자원":     "한국소비자원 (KCA) — 소비자 보호 공공기관",
  "공정거래위원회":   "공정거래위원회 (KFTC) — 공정거래 감독 정부기관",
};

// 별칭·약칭 → 정식 기관명 매핑 (입력값을 정규화하는 데 사용)
export const INSTITUTION_ALIASES: Record<string, string> = {
  // 금융감독원
  "금감원": "금융감독원", "금융감독": "금융감독원", "FSS": "금융감독원",
  // 금융위원회
  "금융위": "금융위원회", "금위": "금융위원회", "FSC": "금융위원회",
  // 한국은행
  "한은": "한국은행", "중앙은행": "한국은행", "BOK": "한국은행",
  // 예금보험공사
  "예보": "예금보험공사", "예금보험": "예금보험공사", "KDIC": "예금보험공사",
  // 한국거래소
  "거래소": "한국거래소", "KRX": "한국거래소", "증권거래소": "한국거래소",
  // 금융정보분석원
  "금정원": "금융정보분석원", "KoFIU": "금융정보분석원", "코피유": "금융정보분석원",
  // 금융결제원
  "금결원": "금융결제원", "KFTC": "금융결제원",
  // 금융보안원
  "금보원": "금융보안원", "FSI": "금융보안원",
  // 경찰청
  "경찰": "경찰청", "치안본부": "경찰청", "경찰서": "경찰청",
  // 검찰청
  "검찰": "검찰청", "대검": "검찰청", "대검찰청": "검찰청", "검찰원": "검찰청",
  // 국세청
  "국세": "국세청", "세청": "국세청", "NTS": "국세청",
  // 관세청
  "관세": "관세청",
  // 국민건강보험공단
  "건보": "국민건강보험공단", "건강보험": "국민건강보험공단",
  "건강보험공단": "국민건강보험공단", "건보공단": "국민건강보험공단", "NHIS": "국민건강보험공단",
  // 국민연금공단
  "국민연금": "국민연금공단", "연금공단": "국민연금공단",
  "연금": "국민연금공단", "NPS": "국민연금공단",
  // 근로복지공단
  "근복공": "근로복지공단", "산재보험": "근로복지공단",
  // 신용보증기금
  "신보": "신용보증기금", "신용보증": "신용보증기금", "KODIT": "신용보증기금",
  // 기술보증기금
  "기보": "기술보증기금", "기술보증": "기술보증기금", "KIBO": "기술보증기금",
  // 서민금융진흥원
  "서금원": "서민금융진흥원", "서민금융": "서민금융진흥원",
  // 한국주택금융공사
  "주금공": "한국주택금융공사", "주택금융": "한국주택금융공사",
  "주택금융공사": "한국주택금융공사", "HF": "한국주택금융공사",
  // 한국자산관리공사
  "캠코": "한국자산관리공사", "자산관리공사": "한국자산관리공사", "KAMCO": "한국자산관리공사",
  // 한국신용정보원
  "신용정보원": "한국신용정보원", "KCIS": "한국신용정보원",
  // 한국인터넷진흥원
  "인터넷진흥원": "한국인터넷진흥원", "진흥원": "한국인터넷진흥원",
  "KISA": "한국인터넷진흥원", "인터넷보안원": "한국인터넷진흥원",
  "한국인터넷": "한국인터넷진흥원",
  // 개인정보보호위원회
  "개인정보위": "개인정보보호위원회", "개보위": "개인정보보호위원회", "PIPC": "개인정보보호위원회",
  // 방송통신위원회
  "방통위": "방송통신위원회", "KCC": "방송통신위원회",
  // 공정거래위원회
  "공정위": "공정거래위원회",
  // 한국소비자원
  "소비자원": "한국소비자원", "소보원": "한국소비자원", "KCA": "한국소비자원",
  // 한국예탁결제원
  "예탁결제원": "한국예탁결제원", "KSD": "한국예탁결제원",
  // 정책금융
  "산업은행": "한국산업은행", "산은": "한국산업은행", "KDB": "한국산업은행",
  "수출입은행": "한국수출입은행", "수은": "한국수출입은행", "KEXIM": "한국수출입은행",
  // 시중은행 별칭
  "국민은행": "KB국민은행", "국민": "KB국민은행", "KB": "KB국민은행", "케이비": "KB국민은행",
  "농협": "NH농협은행", "농협은행": "NH농협은행", "NH": "NH농협은행",
  "기업은행": "IBK기업은행", "기업": "IBK기업은행", "IBK": "IBK기업은행",
  "카뱅": "카카오뱅크", "카카오": "카카오뱅크",
  "토뱅": "토스뱅크", "토스": "토스뱅크",
  "케뱅": "케이뱅크",
  "제일은행": "SC제일은행", "SC": "SC제일은행",
  "씨티": "한국씨티은행",
  "대구은행": "DGB대구은행",
  "부산은행": "BNK부산은행",
  "경남은행": "BNK경남은행",
  // 카드 별칭
  "국민카드": "KB국민카드", "KB카드": "KB국민카드",
  // 증권 별칭
  "미래에셋": "미래에셋증권",
  "한투": "한국투자증권",
  "키움": "키움증권",
  "NH투자": "NH투자증권",
};

// 공식 금융사 도메인 화이트리스트
export const OFFICIAL_DOMAINS = [
  "kbstar.com", "shinhan.com", "wooribank.com", "kebhana.com",
  "nonghyup.com", "ibk.co.kr", "kakaobank.com", "tossbank.com",
  "fss.or.kr", "fsc.go.kr", "bok.or.kr", "kdic.or.kr",
  "krx.co.kr", "nts.go.kr", "police.go.kr",
];

// 피싱 패턴 블랙리스트
export const BLACKLISTED_DOMAINS = [
  "secure-login", "kb-bank", "shinhan-auth", "woori-verify",
  "bank-confirm", "금융감독원", "금감원", "금융위", "account-check",
  "auth-bank", "login-kb", "kbstar-secure", "hana-auth",
];

// ─── 더치트 mock API ────────────────────────────────────────────────────────
export async function callTheCheAt(query: string): Promise<TheCheAtResult> {
  const res = await fetch("/api/thecheat/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error("더치트 API 오류");
  const json = await res.json();
  return json.data as TheCheAtResult;
}

// ─── 전화번호 검증 ──────────────────────────────────────────────────────────
export async function verifyPhone(raw: string): Promise<VerifyResult> {
  const clean = raw.replace(/[-\s]/g, "");

  const official = OFFICIAL_PHONES[clean];
  if (official) {
    return { status: "safe", label: "공식 기관 번호", detail: `${official}의 공식 대표번호입니다.` };
  }

  // 070 인터넷전화 — 보이스피싱 다발
  if (clean.startsWith("070")) {
    const tc = await callTheCheAt(clean).catch(() => null);
    return {
      status: "danger",
      label: "070 인터넷전화",
      detail: "공식 금융·정부기관은 070 번호를 사용하지 않습니다. 보이스피싱을 의심하세요.",
      thecheat: tc,
    };
  }

  // 해외번호 (+로 시작)
  if (raw.trim().startsWith("+") && !raw.startsWith("+82")) {
    return { status: "danger", label: "해외번호", detail: "국내 금융기관은 해외번호로 연락하지 않습니다." };
  }

  const tc = await callTheCheAt(clean).catch(() => null);
  if (tc?.found) {
    return {
      status: "danger",
      label: `더치트 신고 ${tc.reportCount}건`,
      detail: `사기 유형: ${tc.scamTypes.join(", ")} · 최근 신고: ${tc.lastReported}`,
      thecheat: tc,
    };
  }

  return {
    status: "unknown",
    label: "확인 불가",
    detail: "공식 번호로 확인되지 않습니다. 직접 은행 앱으로 연락처를 확인하세요.",
    thecheat: tc,
  };
}

// ─── URL 검증 ───────────────────────────────────────────────────────────────
export async function verifyUrl(raw: string): Promise<VerifyResult> {
  const lower = raw.toLowerCase().trim();

  // IP 주소 직접 접속 패턴
  if (/https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(lower)) {
    return { status: "danger", label: "IP 직접 접속", detail: "IP 주소로 직접 접속하는 URL은 피싱 사이트일 가능성이 높습니다." };
  }

  // 블랙리스트 키워드
  const blackHit = BLACKLISTED_DOMAINS.find((b) => lower.includes(b.toLowerCase()));
  if (blackHit) {
    const tc = await callTheCheAt(raw).catch(() => null);
    return {
      status: "danger",
      label: "피싱 의심 URL",
      detail: `"${blackHit}" 패턴이 포함된 피싱 도메인입니다.`,
      thecheat: tc,
    };
  }

  // 화이트리스트 도메인
  const whiteHit = OFFICIAL_DOMAINS.find((d) => lower.includes(d));
  if (whiteHit) {
    // HTTPS 여부도 확인
    if (!lower.startsWith("https")) {
      return { status: "caution", label: "공식 도메인 · HTTP", detail: `${whiteHit}의 공식 도메인이나 HTTPS가 아닙니다. 주소창을 다시 확인하세요.` };
    }
    return { status: "safe", label: "공식 도메인", detail: `${whiteHit}의 공식 도메인으로 확인됩니다.` };
  }

  const tc = await callTheCheAt(raw).catch(() => null);
  if (tc?.found) {
    return {
      status: "danger",
      label: `더치트 신고 ${tc.reportCount}건`,
      detail: `사기 유형: ${tc.scamTypes.join(", ")} · 최근 신고: ${tc.lastReported}`,
      thecheat: tc,
    };
  }

  return {
    status: "caution",
    label: "확인 불가",
    detail: "공식 도메인이 아닙니다. 해당 기관의 공식 앱 또는 공식 홈페이지로 직접 접속하세요.",
    thecheat: tc,
  };
}

// ─── 금융위원회 등록 금융기관 로컬 DB (API 장애 시 폴백) ────────────────────
// 출처: 금융위원회 금융회사 공시 (2025 기준)
export const KNOWN_FN_COMPANIES: Record<string, string> = {
  // 은행
  "KB국민은행":   "은행", "신한은행": "은행", "하나은행": "은행",
  "우리은행":     "은행", "NH농협은행": "은행", "IBK기업은행": "은행",
  "카카오뱅크":   "은행", "토스뱅크": "은행", "케이뱅크": "은행",
  "SC제일은행":   "은행", "한국씨티은행": "은행", "DGB대구은행": "은행",
  "BNK부산은행":  "은행", "광주은행": "은행", "전북은행": "은행",
  "BNK경남은행":  "은행", "제주은행": "은행", "Sh수협은행": "은행",
  "한국산업은행": "은행", "한국수출입은행": "은행", "중소기업은행": "은행",
  // 증권
  "미래에셋증권": "금융투자", "삼성증권": "금융투자", "KB증권": "금융투자",
  "한국투자증권": "금융투자", "신한투자증권": "금융투자", "하나증권": "금융투자",
  "메리츠증권":   "금융투자", "NH투자증권": "금융투자", "키움증권": "금융투자",
  "대신증권":     "금융투자", "한화투자증권": "금융투자", "교보증권": "금융투자",
  // 생명보험
  "삼성생명":   "생명보험", "한화생명": "생명보험", "교보생명": "생명보험",
  "신한라이프": "생명보험", "KB라이프생명": "생명보험", "흥국생명": "생명보험",
  // 손해보험
  "삼성화재":   "손해보험", "DB손해보험": "손해보험", "현대해상": "손해보험",
  "KB손해보험": "손해보험", "메리츠화재": "손해보험", "하나손해보험": "손해보험",
  // 카드
  "신한카드": "여신전문", "삼성카드": "여신전문", "KB국민카드": "여신전문",
  "현대카드": "여신전문", "롯데카드": "여신전문", "우리카드": "여신전문",
  "하나카드": "여신전문", "BC카드": "여신전문",
  // 캐피탈
  "현대캐피탈":     "여신전문", "KB캐피탈": "여신전문", "하나캐피탈": "여신전문",
  "우리금융캐피탈": "여신전문", "신한캐피탈": "여신전문",
  // 저축은행
  "SBI저축은행": "저축은행", "OK저축은행": "저축은행",
  "웰컴저축은행": "저축은행", "페퍼저축은행": "저축은행",
};

// FSC API 응답이 에러 포맷인지 확인
function isFscError(json: unknown): boolean {
  return !!(json && typeof json === "object" && "OpenAPI_ServiceResponse" in (json as object));
}

// FSC API 호출 (실패 시 null 반환)
async function fetchFscApi(name: string): Promise<{ fncoNm: string; corpRegNo?: string }[] | null> {
  const key = import.meta.env.VITE_FSC_API_KEY as string | undefined;
  if (!key) return null;
  try {
    const url =
      `https://apis.data.go.kr/1160100/service/GetFnCoBasiInfoService/getBasList` +
      `?serviceKey=${key}&resultType=json&numOfRows=5&pageNo=1&fncoNm=${encodeURIComponent(name)}`;
    const res = await fetch(url);
    const json = await res.json();
    if (isFscError(json)) return null;            // API 서비스 중단 등 에러
    const items = json?.response?.body?.items?.item;
    if (!items) return null;
    return Array.isArray(items) ? items : [items];
  } catch {
    return null;
  }
}

// ─── 기관명 검증 ────────────────────────────────────────────────────────────
export async function verifyInstitution(name: string): Promise<VerifyResult> {
  const trimmed = name.trim();

  // 0차: 별칭·약칭 → 정식 기관명 변환
  const canonical = INSTITUTION_ALIASES[trimmed] ?? INSTITUTION_ALIASES[trimmed.toUpperCase()] ?? trimmed;
  const aliasNote = canonical !== trimmed ? `'${trimmed}'은(는) '${canonical}'의 약칭으로 인식됩니다. ` : "";

  // 1차: 정부·감독기관 화이트리스트
  const govHit = OFFICIAL_GOV_BODIES[canonical];
  if (govHit) {
    return { status: "safe", label: "공식 감독·정부기관", detail: aliasNote + govHit };
  }

  // 2차: 금융위원회 OpenAPI (성공 시 우선 사용)
  const apiItems = await fetchFscApi(canonical);
  if (apiItems) {
    const exact = apiItems.find((it) => it.fncoNm === canonical);
    if (exact) {
      return {
        status: "safe",
        label: "금융위원회 등록 기관",
        detail: aliasNote + `금융위원회에 정식 등록된 금융사입니다.${exact.corpRegNo ? ` 법인번호: ${exact.corpRegNo}` : ""}`,
      };
    }
    const similar = apiItems.map((it) => it.fncoNm).join(", ");
    return {
      status: "caution",
      label: "유사 기관명 존재",
      detail: aliasNote + `정확히 일치하지 않습니다. 유사 등록명: ${similar}`,
    };
  }

  // 3차: 로컬 DB 폴백 (API 장애·키 만료 시)
  const localHit = KNOWN_FN_COMPANIES[canonical];
  if (localHit) {
    return {
      status: "safe",
      label: "금융위원회 등록 기관",
      detail: aliasNote + `금융위원회 등록 ${localHit} — 공식 금융회사입니다.`,
    };
  }

  // 부분 일치 탐색
  const searchKey = canonical.replace(/은행|증권|보험|카드|캐피탈|저축은행|공단|공사|위원회|청$/g, "").trim();
  const partialMatches = Object.keys({ ...OFFICIAL_GOV_BODIES, ...KNOWN_FN_COMPANIES }).filter(
    (k) => (searchKey.length >= 2 && (k.includes(canonical) || k.includes(searchKey) || canonical.includes(k)))
  ).slice(0, 3);

  if (partialMatches.length > 0) {
    return {
      status: "caution",
      label: "유사 기관명 존재",
      detail: aliasNote + `정확히 일치하지 않습니다. 유사 기관: ${partialMatches.join(", ")}`,
    };
  }

  return {
    status: "caution",
    label: "등록 기관 없음",
    detail: aliasNote + "금융위원회 등록 금융사 목록에 없습니다. 직접 확인을 권장합니다.",
  };
}
