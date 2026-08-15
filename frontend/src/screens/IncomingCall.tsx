// 아이폰 스타일 수신 전화 화면

import { useEffect, useState } from 'react'
import { screenCall, type CallScreenResult } from '../shared/callscreen'

interface Props {
  call: { display: string; number: string; label: string }
  onDismiss: () => void
}

function Ring({ delay }: { delay: number }) {
  return (
    <div
      className="absolute inset-0 rounded-full border-2 border-white/20 animate-ping"
      style={{ animationDelay: `${delay}ms`, animationDuration: '2s' }}
    />
  )
}

export default function IncomingCall({ call, onDismiss }: Props) {
  const [result, setResult] = useState<CallScreenResult | null>(null)

  useEffect(() => {
    screenCall(call.number).then(setResult)
  }, [call.number])

  const dismiss = () => onDismiss()

  const isSafe    = result?.status === 'safe'
  const isDanger  = result?.status === 'danger'

  const avatarBg  = isSafe ? '#1a4fa0' : isDanger ? '#7f1d1d' : '#374151'
  const wallpaper = isSafe
    ? 'radial-gradient(ellipse at 20% 20%, #1e3a8a 0%, #0f172a 60%), linear-gradient(180deg, #1e3a8a 0%, #030712 100%)'
    : isDanger
    ? 'radial-gradient(ellipse at 20% 20%, #7f1d1d 0%, #0c0a09 60%), linear-gradient(180deg, #450a0a 0%, #030712 100%)'
    : 'radial-gradient(ellipse at 20% 20%, #1f2937 0%, #030712 60%), linear-gradient(180deg, #111827 0%, #030712 100%)'

  const displayName = result?.institutionName ?? call.display

  return (
    /* 앱 컨테이너 전체를 덮는 절대 오버레이 */
    <div className="absolute inset-0 z-[100] flex flex-col overflow-hidden" style={{ background: wallpaper }}>

      {/* 상단 노이즈 텍스처 느낌 */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
        backgroundSize: '200px 200px',
      }} />

      {/* iOS 상태바 */}
      <div className="relative flex justify-between items-center px-7 pt-4 pb-2 text-white text-[14px] font-semibold">
        <span>9:41</span>
        <div className="flex items-center gap-1.5">
          {/* 안테나 */}
          <svg viewBox="0 0 17 12" fill="white" className="h-3">
            <rect x="0"  y="3" width="3" height="9" rx="1" />
            <rect x="4.5" y="2" width="3" height="10" rx="1" />
            <rect x="9"  y="1" width="3" height="11" rx="1" />
            <rect x="13.5" y="0" width="3" height="12" rx="1" opacity="0.3"/>
          </svg>
          {/* 와이파이 */}
          <svg viewBox="0 0 16 12" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" className="h-3">
            <path d="M1 4.5 C4 1.5 12 1.5 15 4.5" opacity="0.3"/>
            <path d="M3 7 C5 5 11 5 13 7"/>
            <path d="M5.5 9.5 C6.5 8.5 9.5 8.5 10.5 9.5"/>
            <circle cx="8" cy="12" r="1" fill="white" stroke="none"/>
          </svg>
          {/* 배터리 */}
          <svg viewBox="0 0 25 12" fill="white" className="h-3">
            <rect x="0" y="1" width="21" height="10" rx="2.5" stroke="white" strokeWidth="1" fill="none" opacity="0.4"/>
            <rect x="22" y="4" width="2" height="4" rx="1" opacity="0.4"/>
            <rect x="1.5" y="2.5" width="17" height="7" rx="1.5"/>
          </svg>
        </div>
      </div>

      {/* 수신 전화 레이블 */}
      <p className="relative text-center text-[13px] font-medium text-white/60 tracking-wide mt-2">
        수신 전화
      </p>

      {/* 연락처 영역 */}
      <div className="relative flex flex-col items-center mt-10 px-6">

        {/* 아바타 + 링 애니메이션 */}
        <div className="relative flex items-center justify-center mb-6">
          <Ring delay={0} />
          <Ring delay={600} />
          <Ring delay={1200} />
          <div
            className="relative w-28 h-28 rounded-full flex items-center justify-center shadow-2xl"
            style={{ backgroundColor: avatarBg }}
          >
            {isSafe ? (
              /* 은행/기관 건물 아이콘 */
              <svg viewBox="0 0 24 24" fill="white" className="w-13 h-13" style={{ width: 52, height: 52 }}>
                <path d="M12 3L2 8.5V10h20V8.5L12 3z"/>
                <rect x="4" y="11" width="3" height="7"/>
                <rect x="8.5" y="11" width="3" height="7"/>
                <rect x="13" y="11" width="3" height="7"/>
                <rect x="17.5" y="11" width="3" height="7"/>
                <rect x="2" y="18" width="20" height="2"/>
              </svg>
            ) : isDanger ? (
              /* 경고 아이콘 */
              <svg viewBox="0 0 24 24" fill="white" className="w-13 h-13" style={{ width: 52, height: 52 }}>
                <path d="M12 2.5L2 20h20L12 2.5zM11 10h2v5h-2zm0 7h2v2h-2z"/>
              </svg>
            ) : (
              /* 알 수 없음 — 물음표 사람 */
              <svg viewBox="0 0 24 24" fill="white" className="w-13 h-13" style={{ width: 52, height: 52 }}>
                <circle cx="12" cy="8" r="4"/>
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" opacity="0.5"/>
              </svg>
            )}
          </div>
        </div>

        {/* 발신자 이름 / 번호 */}
        <h1 className="text-[32px] font-semibold text-white text-center leading-tight mb-1">
          {displayName}
        </h1>
        {result?.institutionName && (
          <p className="text-[16px] text-white/50 mb-1">{call.display}</p>
        )}

        {/* 스크리닝 결과 카드 */}
        <div className="mt-5 w-full">
          {!result ? (
            <div className="flex items-center justify-center gap-2 bg-white/10 rounded-2xl px-5 py-3">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span className="text-[14px] text-white/60">발신자 검증 중…</span>
            </div>
          ) : (
            <div className={`rounded-2xl px-5 py-4 text-center ${
              isSafe   ? 'bg-green-500/20 border border-green-400/30' :
              isDanger ? 'bg-red-500/20   border border-red-400/30'   :
                         'bg-white/10     border border-white/15'
            }`}>
              <p className={`text-[15px] font-semibold ${
                isSafe ? 'text-green-300' : isDanger ? 'text-red-300' : 'text-white/70'
              }`}>
                {isSafe ? '✅' : isDanger ? '🚨' : '❓'}&nbsp;{result.reason}
              </p>
              <p className="text-[13px] text-white/60 mt-1 leading-relaxed">{result.detail}</p>
              {result.scamTypes && result.scamTypes.length > 0 && (
                <div className="flex flex-wrap gap-1.5 justify-center mt-2">
                  {result.scamTypes.map((t) => (
                    <span key={t} className="bg-white/15 text-white/80 text-[11px] rounded-full px-2.5 py-0.5">{t}</span>
                  ))}
                </div>
              )}
              {result.fsaVerified && (
                <p className="text-[12px] text-green-300/70 mt-2">금융위원회 인증 ✓</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 스페이서 */}
      <div className="flex-1" />

      {/* 하단 액션 버튼 영역 */}
      <div className="relative pb-14 px-10">

        {/* 작은 버튼 행 — 알림 / 문자 메시지 */}
        <div className="flex justify-around mb-10">
          {[
            {
              label: '알림',
              icon: (
                <svg viewBox="0 0 24 24" fill="white" style={{ width: 26, height: 26 }}>
                  <path d="M12 2a10 10 0 110 20A10 10 0 0112 2zm0 3v6.6l3.6 2.1-.9 1.5-4.7-2.7V5h2z"/>
                </svg>
              ),
            },
            {
              label: '문자 메시지',
              icon: (
                <svg viewBox="0 0 24 24" fill="white" style={{ width: 26, height: 26 }}>
                  <path d="M20 2H4a2 2 0 00-2 2v16l4-4h14a2 2 0 002-2V4a2 2 0 00-2-2z"/>
                </svg>
              ),
            },
          ].map(({ label, icon }) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <button className="w-[62px] h-[62px] rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center active:bg-white/25 transition-colors">
                {icon}
              </button>
              <span className="text-white/60 text-[13px]">{label}</span>
            </div>
          ))}
        </div>

        {/* 큰 거부 / 수신 버튼 */}
        <div className="flex justify-between items-start">

          {/* 수신 거부 */}
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={dismiss}
              className="w-[78px] h-[78px] rounded-full bg-red-500 flex items-center justify-center active:scale-95 transition-transform"
              style={{ boxShadow: '0 8px 32px rgba(239,68,68,0.4)' }}
            >
              <svg viewBox="0 0 24 24" fill="white" style={{ width: 36, height: 36, transform: 'rotate(135deg)' }}>
                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
              </svg>
            </button>
            <span className="text-white/60 text-[14px]">수신 거부</span>
          </div>

          {/* 수신 */}
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={dismiss}
              className={`w-[78px] h-[78px] rounded-full flex items-center justify-center active:scale-95 transition-transform ${
                isDanger ? 'bg-orange-400' : 'bg-green-500'
              }`}
              style={{ boxShadow: isDanger ? '0 8px 32px rgba(251,146,60,0.4)' : '0 8px 32px rgba(34,197,94,0.4)' }}
            >
              <svg viewBox="0 0 24 24" fill="white" style={{ width: 36, height: 36 }}>
                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
              </svg>
            </button>
            <span className="text-white/60 text-[14px]">수신</span>
          </div>

        </div>
      </div>
    </div>
  )
}
