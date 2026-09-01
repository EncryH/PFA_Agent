// 전화 수신 스크리닝 — 블랙리스트/화이트리스트 대조 + FSC API 검증

import { OFFICIAL_PHONES, OFFICIAL_GOV_BODIES, KNOWN_FN_COMPANIES } from './verify'

export interface CallScreenResult {
  status: 'safe' | 'danger' | 'unknown'
  institutionName?: string
  fsaVerified?: boolean
  reportCount?: number
  scamTypes?: string[]
  reason: string
  detail: string
}

// 보이스피싱 신고 번호 블랙리스트 (MVP용 임의 데이터셋)
export const CALL_BLACKLIST: Record<string, { reportCount: number; scamTypes: string[] }> = {
  "07012341234": { reportCount: 29, scamTypes: ["기관사칭", "보이스피싱"] },
  "07098765432": { reportCount: 22, scamTypes: ["보이스피싱", "기관사칭"] },
  "01012345678": { reportCount: 14, scamTypes: ["기관사칭", "보이스피싱"] },
  "01098765432": { reportCount: 6,  scamTypes: ["대출사기"] },
  "01055556666": { reportCount: 3,  scamTypes: ["스미싱"] },
  "01099990000": { reportCount: 11, scamTypes: ["투자사기"] },
  "01077778888": { reportCount: 18, scamTypes: ["보이스피싱", "개인정보탈취"] },
  "0212345678":  { reportCount: 8,  scamTypes: ["기관사칭"] },
  "0325551234":  { reportCount: 5,  scamTypes: ["보이스피싱"] },
  "01033334444": { reportCount: 9,  scamTypes: ["대출사기", "투자사기"] },
}

// 심사위원 데모용 시나리오 (아이콘 탭할 때마다 순환)
export const DEMO_SCENARIOS: { display: string; number: string; label: string }[] = [
  { display: "1588-1688",     number: "15881688",    label: "KB국민은행" },
  { display: "070-1234-1234", number: "07012341234", label: "070 기관사칭" },
  { display: "1100-1001",     number: "11001001",    label: "금융감독원" },
  { display: "010-1234-5678", number: "01012345678", label: "보이스피싱 신고번호" },
  { display: "1544-4000",     number: "15444000",    label: "신한은행" },
  { display: "010-9999-0000", number: "01099990000", label: "투자사기 번호" },
  { display: "02-9876-5432",  number: "0298765432",  label: "알 수 없음" },
]

export async function screenCall(raw: string): Promise<CallScreenResult> {
  const clean = raw.replace(/[-\s]/g, '')

  // 1. 070 인터넷전화 — 공식 기관은 절대 사용 안 함
  if (clean.startsWith('070')) {
    const hit = CALL_BLACKLIST[clean]
    return {
      status: 'danger',
      reason: hit
        ? `070 인터넷전화 · 보이스피싱 신고 ${hit.reportCount}건`
        : '070 인터넷전화',
      detail: '공식 금융·정부기관은 070 번호를 사용하지 않습니다. 기관사칭 가능성이 높습니다.',
      reportCount: hit?.reportCount,
      scamTypes: hit?.scamTypes,
    }
  }

  // 2. 블랙리스트
  const blackHit = CALL_BLACKLIST[clean]
  if (blackHit) {
    return {
      status: 'danger',
      reason: `보이스피싱 신고 ${blackHit.reportCount}건`,
      detail: `사기 유형: ${blackHit.scamTypes.join(', ')} · 수신을 거부하세요.`,
      reportCount: blackHit.reportCount,
      scamTypes: blackHit.scamTypes,
    }
  }

  // 3. 화이트리스트 (OFFICIAL_PHONES) + FSC API 2차 검증
  const institutionName = OFFICIAL_PHONES[clean]
  if (institutionName) {
    // 정부기관은 FSC API 조회 없이 바로 안전 처리
    if (OFFICIAL_GOV_BODIES[institutionName]) {
      return {
        status: 'safe',
        institutionName,
        fsaVerified: true,
        reason: '공식 정부·감독기관',
        detail: OFFICIAL_GOV_BODIES[institutionName],
      }
    }

    // 금융사 → FSC API 검증(백엔드 프록시 /api/fsc/verify — verify.ts 와 같은 경로) → 실패 시 로컬 DB 폴백
    let fsaVerified = false
    try {
      const res = await fetch(`/api/fsc/verify?name=${encodeURIComponent(institutionName)}`)
      if (res.ok) {
        const json = await res.json()
        const items: { fncoNm: string }[] | null = json?.items ?? null
        fsaVerified = !!items?.some((it) => it.fncoNm === institutionName)
      }
    } catch { /* FSC API 네트워크 오류 */ }

    // API 실패 시 로컬 DB로 대체 검증
    if (!fsaVerified) {
      fsaVerified = institutionName in KNOWN_FN_COMPANIES
    }

    return {
      status: 'safe',
      institutionName,
      fsaVerified,
      reason: '공식 금융기관 대표번호',
      detail: fsaVerified
        ? '금융위원회 등록 금융사 · 공식 대표번호'
        : '공식 대표번호 화이트리스트에 등록된 번호',
    }
  }

  // 4. 알 수 없음
  return {
    status: 'unknown',
    reason: '알 수 없는 발신자',
    detail: '등록되지 않은 번호입니다. 중요한 연락이라면 직접 공식 번호로 확인하세요.',
  }
}
