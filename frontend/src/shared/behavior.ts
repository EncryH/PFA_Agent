// 사용자 행동 신호 — App 레벨에서 수집해 Transfer로 전달한다.

export interface BehaviorSignals {
  historyVisits: number       // 잔액/거래내역 조회 횟수 (세션 내 누적)
  verifyVisited: boolean      // 상대방 검증 탭 방문 여부
  savingsEarlyClose: boolean  // 적금/예금 중도해지 시도 여부
}

export const INITIAL_SIGNALS: BehaviorSignals = {
  historyVisits: 0,
  verifyVisited: false,
  savingsEarlyClose: false,
}
