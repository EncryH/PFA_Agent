// /api/risk-score 호출 래퍼

import type { BehaviorSignals } from '../shared/behavior'

export interface RiskResult {
  score: number
  grade: 'A' | 'B' | 'C' | 'D'
  gradeLabel: string
  gradeColor: 'safe' | 'caution' | 'warning' | 'danger'
  // 1층(상대방 검증)이 PASS/BLOCK 으로 즉시 확정한 경우에만 채워진다.
  counterpartyScore?: number
  behaviorScore: number
  transferSignalScore: number
  reasons: string[]
  stoppedAt?: string
  thecheat?: { reportCount: number; scamTypes: string[]; lastReported: string }
}

export interface RiskPayload {
  // 1층(상대방 검증) 입력 — 생략해도 동작한다(1층이 CONTINUE 로 넘어가며 점수도 안 준다).
  counterparty?: { account?: string; phone?: string; domain?: string }
  behavior: BehaviorSignals & { backPresses: number; sessionSeconds: number; recentCallLinked: boolean }
  transaction: {
    amount: number
    isKnownRecipient: boolean
    isMyAccount: boolean
    hourOfDay: number
  }
}

export async function fetchRiskScore(payload: RiskPayload): Promise<RiskResult> {
  const res = await fetch('/api/risk-score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`risk-score ${res.status}`)
  return res.json()
}
