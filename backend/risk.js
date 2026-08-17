// 행동 감지 + 거래 검사 통합 위험도 채점
// 규칙 기반 — LLM 없이도 동작하며, 백엔드에서만 실행된다.
// 프론트엔드는 0~100 점수를 받아 A~D 등급으로 표시한다.

export function scoreRisk(payload) {
  const { behavior = {}, transaction = {} } = payload
  const reasons = []
  let behaviorScore = 0
  let transactionScore = 0

  // ── 행동 감지 ──────────────────────────────────────────────────
  // 적금 중도해지 — 단독으로도 강한 경보 신호 (보이스피싱 전형 패턴)
  if (behavior.savingsEarlyClose) {
    behaviorScore += 35
    reasons.push('적금 중도 해지 후 즉시 이체')
  }

  const visits = Number(behavior.historyVisits ?? 0)
  if (visits >= 3) {
    behaviorScore += 28
    reasons.push(`잔액 ${visits}회 반복 조회`)
  } else if (visits >= 1) {
    behaviorScore += 15
    reasons.push('잔액 반복 조회')
  }

  if (!behavior.verifyVisited) {
    behaviorScore += 8
    reasons.push('상대방 검증 미실시')
  }

  const sec = Number(behavior.sessionSeconds ?? 999)
  if (sec < 15) {
    behaviorScore += 18
    reasons.push('매우 빠른 이체 시도')
  } else if (sec < 30) {
    behaviorScore += 8
  }

  // ── 거래 검사 ──────────────────────────────────────────────────
  const amt = Number(transaction.amount ?? 0)
  if (amt >= 10_000_000) {
    transactionScore += 25
    reasons.push('고액 이체 (1천만원 이상)')
  } else if (amt >= 3_000_000) {
    transactionScore += 15
    reasons.push('고액 이체 (300만원 이상)')
  } else if (amt >= 1_000_000) {
    transactionScore += 8
  }

  if (!transaction.isKnownRecipient && !transaction.isMyAccount) {
    transactionScore += 20
    reasons.push('미등록 수취인')
  }

  const hour = Number(transaction.hourOfDay ?? 12)
  if (hour < 6 || hour >= 23) {
    transactionScore += 15
    reasons.push('야간 이체')
  }

  // ── 종합 등급 ──────────────────────────────────────────────────
  const score = Math.min(100, behaviorScore + transactionScore)

  let grade, gradeLabel, gradeColor
  if (score >= 76)      { grade = 'D'; gradeLabel = '위험'; gradeColor = 'danger'  }
  else if (score >= 51) { grade = 'C'; gradeLabel = '경계'; gradeColor = 'warning' }
  else if (score >= 26) { grade = 'B'; gradeLabel = '주의'; gradeColor = 'caution' }
  else                  { grade = 'A'; gradeLabel = '안전'; gradeColor = 'safe'    }

  return { score, grade, gradeLabel, gradeColor, behaviorScore, transactionScore, reasons }
}
