// /api/risk-score 호출 래퍼

import type { BehaviorSignals } from '../shared/behavior'

export interface RiskResult {
  score: number
  grade: 'A' | 'B' | 'C' | 'D'
  gradeLabel: string
  gradeColor: 'safe' | 'caution' | 'warning' | 'danger'
  behaviorScore: number
  transactionScore: number
  reasons: string[]
}

export interface RiskPayload {
  behavior: BehaviorSignals & { backPresses: number; sessionSeconds: number }
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
