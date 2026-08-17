// 문자 수신 시뮬레이션 데이터셋

export interface DemoMessage {
  sender: string    // 발신자 표시명
  number: string    // 발신번호 (clean)
  body: string      // 메시지 본문
  url: string | null
}

export const DEMO_MESSAGES: DemoMessage[] = [
  {
    sender: 'KB국민은행',
    number: '15881688',
    body: '[KB국민은행] 이체 완료 안내입니다. 상세 내역 확인: https://kbstar.com/history?ref=tx9823',
    url: 'https://kbstar.com/history?ref=tx9823',
  },
  {
    sender: '010-5555-1234',
    number: '01055551234',
    body: '[KB국민은행] 귀하의 계좌가 이상거래로 잠겼습니다. 즉시 해제하세요: https://kb-safe.com/unlock',
    url: 'https://kb-safe.com/unlock',
  },
  {
    sender: '070-1234-5678',
    number: '07012345678',
    body: '[금융감독원] 개인정보 확인이 필요합니다. 아래 링크에서 즉시 인증하세요: http://192.168.0.1/fss/verify',
    url: 'http://192.168.0.1/fss/verify',
  },
  {
    sender: '신한은행',
    number: '15444000',
    body: '[신한은행] 안심 보안 서비스 안내드립니다. 자세한 정보: https://shinhan.com/security-guide',
    url: 'https://shinhan.com/security-guide',
  },
  {
    sender: '010-9876-0000',
    number: '01098760000',
    body: '대출 금리 최저 연 2.9%! 지금 바로 신청하세요 → https://secure-login.kr/loan?utm_src=sms',
    url: 'https://secure-login.kr/loan?utm_src=sms',
  },
  {
    sender: '국세청',
    number: '1544126',
    body: '[국세청] 세금 환급금 5만원이 있습니다. 수령하시려면 본인 확인: https://woori-verify.com/tax-refund',
    url: 'https://woori-verify.com/tax-refund',
  },
]

// 본문에서 URL 추출
export function extractUrl(body: string): string | null {
  const m = body.match(/https?:\/\/[^\s]+/)
  return m ? m[0] : null
}
