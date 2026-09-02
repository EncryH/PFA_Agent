// iOS 잠금해제 상태 수신 배너 — 상단 pill 카드 슬라이드인

import { useEffect, useState } from 'react'
import { screenCall, screenCallImmediate, type CallScreenResult } from '../shared/callscreen'

interface Props {
  call: { display: string; number: string; label: string }
  onDismiss: () => void
}

export default function IncomingCall({ call, onDismiss }: Props) {
  const [visible, setVisible] = useState(false)
  const [result, setResult] = useState<CallScreenResult>(() => screenCallImmediate(call.number))
  const [ring, setRing] = useState(true)

  // 슬라이드인
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 40)
    return () => clearTimeout(t)
  }, [])

  // 전화 벨 흔들림
  useEffect(() => {
    const id = setInterval(() => setRing((r) => !r), 700)
    return () => clearInterval(id)
  }, [])

  // 스크리닝
  useEffect(() => {
    let active = true
    setResult(screenCallImmediate(call.number))
    screenCall(call.number).then((next) => { if (active) setResult(next) })
    return () => { active = false }
  }, [call.number])

  const dismiss = () => {
    setVisible(false)
    setTimeout(onDismiss, 280)
  }

  const isSafe   = result.status === 'safe'
  const isDanger = result.status === 'danger'

  const circleBg = isSafe
    ? 'bg-[var(--ac-500)]'
    : isDanger
    ? 'bg-red-600'
    : 'bg-amber-500'
  const statusLabel = isSafe ? '공식 확인' : isDanger ? '위험 감지' : '추가 확인'
  const statusClass = isSafe
    ? 'border-emerald-400/30 bg-emerald-400/15 text-emerald-300'
    : isDanger
      ? 'border-red-400/35 bg-red-400/15 text-red-300'
      : 'border-amber-400/30 bg-amber-400/15 text-amber-300'

  return (
    /* 앱 상단 고정 오버레이 */
    <div
      className={`absolute top-0 left-0 right-0 z-[100] px-2 pt-2 transition-transform duration-300 ease-out ${
        visible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div
        className={`overflow-hidden rounded-[22px] border shadow-2xl ${isDanger ? 'border-red-400/35' : 'border-white/15'}`}
        style={{
          background: 'rgba(58,58,63,0.95)',
          backdropFilter: 'blur(32px) saturate(140%)',
          WebkitBackdropFilter: 'blur(32px) saturate(140%)',
          boxShadow: '0 14px 38px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
      >
        <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.06] px-3 py-2">
          <div className="flex items-center gap-2">
            <img src="/ansim-ai-profile.png" alt="안심동행 AI" className="h-7 w-7 rounded-full border border-white/20 bg-white object-cover" />
            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-extrabold text-[var(--ac-200)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--ac-300)]" />
                안심동행 AI 발신자 확인
              </p>
              <p className="text-[8px] text-white/45">수신 전 자동 검증했어요</p>
            </div>
          </div>
          <span className={`rounded-full border px-2 py-0.5 text-[8px] font-bold ${statusClass}`}>{statusLabel}</span>
        </div>

        <div className="flex items-center gap-2.5 px-3 py-2.5">

          {/* 왼쪽: 상태 원 (이미지의 인물사진 원 자리) */}
          <div className={`relative w-[38px] h-[38px] rounded-full flex-shrink-0 flex items-center justify-center ${circleBg}`}>
            {/* 전화 아이콘 — 벨처럼 흔들림 */}
            <svg
              viewBox="0 0 24 24"
              fill="white"
              style={{
                width: 20,
                height: 20,
                transform: `rotate(${ring ? '12deg' : '-12deg'})`,
                transition: 'transform 0.2s ease',
              }}
            >
              <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
            </svg>
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#3a3a3f] ${
                isSafe ? 'bg-green-400' : isDanger ? 'bg-red-400' : 'bg-gray-400'
              }`}
            />
          </div>

          {/* 중앙: 검증 결과 + 번호 (이미지의 "FaceTime 영상통화" + "Danny Lopez" 자리) */}
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-extrabold tracking-wide leading-tight text-white truncate">
              {result.institutionName ?? call.display}
            </p>
            <p className={`mt-0.5 truncate text-[10px] font-semibold ${isDanger ? 'text-red-300' : isSafe ? 'text-emerald-300' : 'text-amber-300'}`}>
              {result.reason}{result.fsaVerified ? ' · 금융위 인증' : ''}
            </p>
            {result.institutionName && <p className="text-[9px] text-white/45">{call.display}</p>}
          </div>

          {/* 오른쪽: 거부 + 수신 버튼 (이미지와 동일 위치) */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* 수신 거부 — 빨간 원 */}
            <button
              onClick={dismiss}
              className="w-[38px] h-[38px] rounded-full bg-red-500 flex items-center justify-center active:scale-90 transition-transform"
              style={{ boxShadow: '0 2px 12px rgba(239,68,68,0.5)' }}
            >
              <svg viewBox="0 0 24 24" fill="white" style={{ width: 18, height: 18, transform: 'rotate(135deg)' }}>
                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
              </svg>
            </button>

            {/* 수신 — 초록 원 */}
            <button
              onClick={dismiss}
              className={`w-[38px] h-[38px] rounded-full flex items-center justify-center active:scale-90 transition-transform ${isDanger ? 'bg-amber-500' : 'bg-green-500'}`}
              style={{ boxShadow: isDanger ? '0 2px 12px rgba(245,158,11,0.35)' : '0 2px 12px rgba(34,197,94,0.35)' }}
            >
              <svg viewBox="0 0 24 24" fill="white" style={{ width: 18, height: 18 }}>
                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
              </svg>
            </button>
          </div>

        </div>

        {/* 상세 검증 정보 — 위험 시 한 줄 더 표시 */}
        {isDanger && result.detail && (
          <div className="border-t border-red-400/20 bg-red-400/10 px-3 py-2">
            <p className="line-clamp-2 text-[10px] leading-snug text-red-200">{result.detail}</p>
          </div>
        )}
        {isSafe && result.detail && (
          <div className="border-t border-emerald-400/20 bg-emerald-400/10 px-3 py-2">
            <p className="line-clamp-2 text-[10px] leading-snug text-emerald-200">{result.detail}</p>
          </div>
        )}
      </div>
    </div>
  )
}
