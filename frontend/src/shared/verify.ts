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

// 금융위원회 API에 등록되지 않은 공식 정부·감독기관 화이트리스트
export const OFFICIAL_GOV_BODIES: Record<string, string> = {
  "금융감독원":   "금융감독원 (FSS) — 금융기관 감독 정부기관",
  "금융위원회":   "금융위원회 (FSC) — 금융정책 최고 의결기관",
  "한국은행":     "한국은행 (BOK) — 중앙은행",
  "예금보험공사": "예금보험공사 (KDIC) — 예금 보호 공공기관",
  "한국거래소":   "한국거래소 (KRX) — 증권·파생상품 거래소",
  "금융정보분석원": "금융정보분석원 (KoFIU) — 자금세탁 방지 정부기관",
  "국민건강보험공단": "국민건강보험공단 — 공공기관",
  "국민연금공단": "국민연금공단 — 공공기관",
  "경찰청":       "대한민국 경찰청 — 정부기관",
  "검찰청":       "대한민국 검찰청 — 정부기관",
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

// ─── 기관명 검증 ────────────────────────────────────────────────────────────
export async function verifyInstitution(name: string): Promise<VerifyResult> {
  const trimmed = name.trim();

  // 1차: 정부·감독기관 화이트리스트
  const govHit = OFFICIAL_GOV_BODIES[trimmed];
  if (govHit) {
    return { status: "safe", label: "공식 감독·정부기관", detail: govHit };
  }

  // 2차: 금융위원회 OpenAPI
  const key = import.meta.env.VITE_FSC_API_KEY as string | undefined;
  if (!key) {
    return { status: "unknown", label: "API 키 없음", detail: "금융위원회 API 키가 설정되지 않았습니다." };
  }

  try {
    const url =
      `https://apis.data.go.kr/1160100/service/GetFnCoBasiInfoService/getBasList` +
      `?serviceKey=${key}&resultType=json&numOfRows=5&pageNo=1&fncoNm=${encodeURIComponent(trimmed)}`;
    const res = await fetch(url);
    const json = await res.json();

    const items = json?.response?.body?.items?.item;
    if (!items) {
      return { status: "caution", label: "등록 기관 없음", detail: "금융위원회 등록 금융사 목록에 없습니다. 직접 확인을 권장합니다." };
    }

    const list: { fncoNm: string; corpRegNo?: string }[] =
      Array.isArray(items) ? items : [items];

    const exact = list.find((it) => it.fncoNm === trimmed);
    if (exact) {
      return {
        status: "safe",
        label: "금융위원회 등록 기관",
        detail: `금융위원회에 정식 등록된 금융사입니다.${exact.corpRegNo ? ` 법인번호: ${exact.corpRegNo}` : ""}`,
      };
    }

    const similar = list.map((it) => it.fncoNm).join(", ");
    return {
      status: "caution",
      label: "유사 기관명 존재",
      detail: `정확히 일치하지 않습니다. 유사 등록명: ${similar}`,
    };
  } catch {
    return { status: "unknown", label: "조회 실패", detail: "금융위원회 API 호출에 실패했습니다." };
  }
}
