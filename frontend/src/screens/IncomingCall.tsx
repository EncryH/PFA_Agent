// 전화 수신 알림 — 상단에서 슬라이드인, 실시간 스크리닝 결과 표시

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

  // 링 애니메이션 토글 (0.8s 주기)
  useEffect(() => {
    const id = setInterval(() => setRing((r) => !r), 800)
    return () => clearInterval(id)
  }, [])

  // 스크리닝
  useEffect(() => {
    screenCall(call.number).then(setResult)
  }, [call.number])

  const dismiss = (answered: boolean) => {
    void answered
    setVisible(false)
    setTimeout(onDismiss, 280)
  }

  const statusTheme = {
    safe:    { bg: 'bg-[#0f2744]', badge: 'bg-green-500',  icon: '✅', answerText: '수신' },
    danger:  { bg: 'bg-[#3b0a0a]', badge: 'bg-red-500',    icon: '🚨', answerText: '수신 (위험)' },
    unknown: { bg: 'bg-[#1a1a2e]', badge: 'bg-gray-500',   icon: '❓', answerText: '수신' },
  }
  const theme = result ? statusTheme[result.status] : statusTheme.unknown

  return (
    /* 전체 오버레이 */
    <div className="absolute inset-0 z-50 pointer-events-none">
      {/* 반투명 딤 */}
      <div
        className={`absolute inset-0 bg-black/40 pointer-events-auto transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={() => dismiss(false)}
      />

      {/* 수신 카드 — 상단에서 슬라이드인 */}
      <div
        className={`absolute top-0 left-0 right-0 pointer-events-auto transition-transform duration-300 ease-out ${
          visible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className={`${theme.bg} rounded-b-3xl shadow-2xl overflow-hidden`}>

          {/* 상태 표시줄 */}
          {result && (
            <div className={`${theme.badge} px-4 py-1.5 flex items-center gap-2`}>
              <span className="text-[12px] text-white font-semibold">{theme.icon} {result.reason}</span>
              {result.fsaVerified && (
                <span className="ml-auto text-[10px] bg-white/20 text-white rounded-full px-2 py-0.5 font-medium">금융위원회 인증</span>
              )}
            </div>
          )}

          <div className="px-5 pt-5 pb-4">
            {/* 수신 전화 헤더 */}
            <div className="flex items-center gap-3 mb-4">
              {/* 전화 아이콘 — 벨 애니메이션 */}
              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform duration-200 ${
                result?.status === 'danger' ? 'bg-red-500/20' : 'bg-white/10'
              } ${ring ? 'rotate-[15deg]' : '-rotate-[15deg]'}`}>
                <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6">
                  <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
                </svg>
              </div>
              <div>
                <p className="text-[11px] text-white/50 font-medium">수신 전화</p>
                <p className="text-[22px] font-bold text-white tracking-wide">{call.display}</p>
              </div>
            </div>

            {/* 스크리닝 결과 */}
            {!result ? (
              <div className="flex items-center gap-2 mb-4 bg-white/5 rounded-xl px-4 py-3">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <p className="text-[13px] text-white/60">발신자 검증 중…</p>
              </div>
            ) : (
              <div className="mb-4 bg-white/5 rounded-xl px-4 py-3 space-y-1">
                {result.institutionName && (
                  <p className="text-[16px] font-bold text-white">{result.institutionName}</p>
                )}
                <p className="text-[13px] text-white/70 leading-relaxed">{result.detail}</p>
                {result.scamTypes && result.scamTypes.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {result.scamTypes.map((t) => (
                      <span key={t} className="text-[11px] bg-red-500/30 text-red-200 rounded-full px-2 py-0.5">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 수신 / 거부 버튼 */}
            <div className="flex gap-3">
              <button
                onClick={() => dismiss(false)}
                className="flex-1 py-3.5 rounded-2xl bg-red-500/80 hover:bg-red-500 active:scale-95 transition-all flex flex-col items-center gap-0.5"
              >
                <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5 rotate-[135deg]">
                  <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
                </svg>
                <span className="text-[11px] text-white font-medium">수신 거부</span>
              </button>

              <button
                onClick={() => dismiss(true)}
                className={`flex-1 py-3.5 rounded-2xl active:scale-95 transition-all flex flex-col items-center gap-0.5 ${
                  result?.status === 'danger'
                    ? 'bg-orange-500/60 hover:bg-orange-500/80'
                    : 'bg-green-500/80 hover:bg-green-500'
                }`}
              >
                <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                  <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
                </svg>
                <span className="text-[11px] text-white font-medium">{theme.answerText}</span>
              </button>
            </div>

            {/* 데모 안내 */}
            <p className="text-center text-[10px] text-white/25 mt-3">시뮬레이션 · 전화 아이콘을 다시 누르면 다음 시나리오</p>
          </div>
        </div>
      </div>
    </div>
  )
}
