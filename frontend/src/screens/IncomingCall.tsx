// iOS 잠금해제 상태 수신 배너 — 상단 pill 카드 슬라이드인

import { useEffect, useState } from 'react'
import { screenCall, type CallScreenResult } from '../shared/callscreen'

interface Props {
  call: { display: string; number: string; label: string }
  onDismiss: () => void
}

export default function IncomingCall({ call, onDismiss }: Props) {
  const [visible, setVisible] = useState(false)
  const [result, setResult] = useState<CallScreenResult | null>(null)
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
    screenCall(call.number).then(setResult)
  }, [call.number])

  const dismiss = () => {
    setVisible(false)
    setTimeout(onDismiss, 280)
  }

  const isSafe   = result?.status === 'safe'
  const isDanger = result?.status === 'danger'

  // 왼쪽 원 색상
  const circleBg = isSafe
    ? 'bg-blue-600'
    : isDanger
    ? 'bg-red-700'
    : 'bg-gray-600'

  // 검증 결과 텍스트 색상 (이미지의 "FaceTime 영상통화" 자리)
  const resultColor = isSafe
    ? 'text-green-400'
    : isDanger
    ? 'text-red-400'
    : 'text-white/50'

  return (
    /* 앱 상단 고정 오버레이 */
    <div
      className={`absolute top-0 left-0 right-0 z-[100] px-3 pt-3 transition-transform duration-300 ease-out ${
        visible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div
        className="rounded-[20px] overflow-hidden"
        style={{
          background: 'rgba(28,28,30,0.96)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
        }}
      >
        <div className="flex items-center gap-3 px-3 py-2.5">

          {/* 왼쪽: 상태 원 (이미지의 인물사진 원 자리) */}
          <div className={`relative w-[42px] h-[42px] rounded-full flex-shrink-0 flex items-center justify-center ${circleBg}`}>
            {/* 전화 아이콘 — 벨처럼 흔들림 */}
            <svg
              viewBox="0 0 24 24"
              fill="white"
              style={{
                width: 22,
                height: 22,
                transform: `rotate(${ring ? '12deg' : '-12deg'})`,
                transition: 'transform 0.2s ease',
              }}
            >
              <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
            </svg>
            {/* 결과 뱃지 (작은 점) */}
            {result && (
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#1c1c1e] ${
                  isSafe ? 'bg-green-400' : isDanger ? 'bg-red-400' : 'bg-gray-400'
                }`}
              />
            )}
          </div>

          {/* 중앙: 검증 결과 + 번호 (이미지의 "FaceTime 영상통화" + "Danny Lopez" 자리) */}
          <div className="flex-1 min-w-0">
            {/* 윗줄 — 검증 결과 (이미지의 "FaceTime 영상통화" 자리) */}
            {!result ? (
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 border border-white/30 border-t-white rounded-full animate-spin" style={{ borderWidth: 1.5 }} />
                <span className="text-white/40 text-[12px]">발신자 검증 중…</span>
              </div>
            ) : (
              <p className={`text-[12px] font-medium leading-tight truncate ${resultColor}`}>
                {isSafe ? '✅' : isDanger ? '🚨' : '❓'} {result.reason}
                {result.fsaVerified ? ' · 금융위 인증' : ''}
              </p>
            )}

            {/* 아랫줄 — 전화번호 (이미지의 "Danny Lopez" 자리) */}
            <p className="text-white text-[17px] font-semibold tracking-wide leading-tight truncate mt-0.5">
              {result?.institutionName ?? call.display}
            </p>
            {result?.institutionName && (
              <p className="text-white/40 text-[11px] leading-tight">{call.display}</p>
            )}
          </div>

          {/* 오른쪽: 거부 + 수신 버튼 (이미지와 동일 위치) */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* 수신 거부 — 빨간 원 */}
            <button
              onClick={dismiss}
              className="w-[42px] h-[42px] rounded-full bg-red-500 flex items-center justify-center active:scale-90 transition-transform"
              style={{ boxShadow: '0 2px 12px rgba(239,68,68,0.5)' }}
            >
              <svg viewBox="0 0 24 24" fill="white" style={{ width: 20, height: 20, transform: 'rotate(135deg)' }}>
                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
              </svg>
            </button>

            {/* 수신 — 초록 원 */}
            <button
              onClick={dismiss}
              className={`w-[42px] h-[42px] rounded-full flex items-center justify-center active:scale-90 transition-transform ${
                isDanger ? 'bg-orange-500' : 'bg-green-500'
              }`}
              style={{ boxShadow: isDanger ? '0 2px 12px rgba(249,115,22,0.5)' : '0 2px 12px rgba(34,197,94,0.5)' }}
            >
              <svg viewBox="0 0 24 24" fill="white" style={{ width: 20, height: 20 }}>
                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
              </svg>
            </button>
          </div>

        </div>

        {/* 상세 검증 정보 — 위험 시 한 줄 더 표시 */}
        {result && isDanger && result.detail && (
          <div className="px-4 pb-3 -mt-1">
            <p className="text-red-300/70 text-[11px] leading-relaxed">{result.detail}</p>
            {result.scamTypes && result.scamTypes.length > 0 && (
              <div className="flex gap-1.5 mt-1 flex-wrap">
                {result.scamTypes.map((t) => (
                  <span key={t} className="bg-red-500/25 text-red-300 text-[10px] rounded-full px-2 py-0.5">{t}</span>
                ))}
              </div>
            )}
          </div>
        )}
        {result && isSafe && result.detail && (
          <div className="px-4 pb-3 -mt-1">
            <p className="text-green-400/60 text-[11px]">{result.detail}</p>
          </div>
        )}
      </div>
    </div>
  )
}
