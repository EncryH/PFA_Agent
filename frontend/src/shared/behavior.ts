// 사용자 행동 신호 — App 레벨에서 수집해 Transfer로 전달한다.

export interface BehaviorSignals {
  historyVisits: number       // 잔액/거래내역 조회 횟수 (세션 내 누적)
  verifyVisited: boolean      // 상대방 검증 탭 방문 여부
  savingsEarlyClose: number   // 적금·예금 중도해지 횟수 (0 = 없음)
  limitIncreased: number      // 이체한도 상향 횟수 (0 = 없음) — 상향 직후 대이체는 전형적 보이스피싱 패턴
  isOnCall: boolean           // 지금 통화 중인 상태로 송금을 시도하는지 — 통화 상대 지시에 따른 송금 정황
}

export const INITIAL_SIGNALS: BehaviorSignals = {
  historyVisits: 0,
  verifyVisited: false,
  savingsEarlyClose: 0,
  limitIncreased: 0,
  isOnCall: false,
}
