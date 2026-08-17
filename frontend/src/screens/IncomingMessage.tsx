// iOS 메시지 알림 배너 — 발신자 스크리닝 결과 포함

import { useEffect, useState } from 'react'
import type { DemoMessage } from '../shared/messages'
import { screenCall, type CallScreenResult } from '../shared/callscreen'

interface Props {
  message: DemoMessage
  onDismiss: () => void
}

function senderColor(sender: string): string {
  const colors = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
    '#10b981', '#06b6d4', '#6366f1', '#ef4444',
  ]
  let h = 0
  for (const c of sender) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return colors[Math.abs(h) % colors.length]
}

function splitBody(body: string, url: string | null): [string, string, string] {
  if (!url) return [body, '', '']
  const idx = body.indexOf(url)
  if (idx === -1) return [body, '', '']
  return [body.slice(0, idx), url, body.slice(idx + url.length)]
}

// 스크리닝 결과 한 줄 배지
function ScreenBadge({ result }: { result: CallScreenResult | null }) {
  if (!result) {
    return (
      <div className="flex items-center gap-1 mt-0.5 mb-1">
        <div className="w-2.5 h-2.5 rounded-full border border-gray-300 border-t-gray-500 animate-spin" style={{ borderWidth: 1.5 }} />
        <span className="text-[11px] text-gray-400">발신자 검증 중…</span>
      </div>
    )
  }

  const isSafe   = result.status === 'safe'
  const isDanger = result.status === 'danger'

  const icon   = isSafe ? '✅' : isDanger ? '🚨' : '❓'
  const color  = isSafe ? 'text-green-600' : isDanger ? 'text-red-500' : 'text-gray-400'
  const bgColor= isSafe ? 'bg-green-50'   : isDanger ? 'bg-red-50'    : 'bg-gray-100'

  return (
    <div className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 mt-0.5 mb-1 ${bgColor}`}>
      <span className="text-[10px]">{icon}</span>
      <span className={`text-[11px] font-medium leading-tight ${color}`}>
        {result.institutionName ? `${result.institutionName} · ` : ''}{result.reason}
        {result.fsaVerified ? ' · 금융위인증' : ''}
        {result.reportCount ? ` · 신고 ${result.reportCount}건` : ''}
      </span>
    </div>
  )
}

export default function IncomingMessage({ message, onDismiss }: Props) {
  const [visible, setVisible] = useState(false)
  const [screen, setScreen]   = useState<CallScreenResult | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 40)
    return () => clearTimeout(t)
  }, [])

  // 발신번호 스크리닝 (전화와 동일 로직)
  useEffect(() => {
    screenCall(message.number).then(setScreen)
  }, [message.number])

  // 5초 후 자동 닫힘
  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 280)
    }, 5000)
    return () => clearTimeout(t)
  }, [onDismiss])

  const dismiss = () => {
    setVisible(false)
    setTimeout(onDismiss, 280)
  }

  const isDanger = screen?.status === 'danger'

  const initial   = message.sender.charAt(0).toUpperCase()
  const avatarBg  = senderColor(message.sender)
  const [before, url, after] = splitBody(message.body, message.url)

  const now     = new Date()
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  return (
    <div
      className={`absolute top-0 left-0 right-0 z-[100] px-3 pt-3 transition-transform duration-300 ease-out ${
        visible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <button
        onClick={dismiss}
        className="w-full text-left"
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        <div
          className="rounded-[20px] px-4 py-3 flex items-start gap-3"
          style={{
            background: 'rgba(242,242,247,0.92)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            boxShadow: isDanger
              ? '0 8px 40px rgba(239,68,68,0.18), 0 1px 4px rgba(0,0,0,0.08)'
              : '0 8px 40px rgba(0,0,0,0.14), 0 1px 4px rgba(0,0,0,0.08)',
            // 위험 발신자는 왼쪽 테두리로 강조
            borderLeft: isDanger ? '3px solid #ef4444' : '3px solid transparent',
          }}
        >
          {/* 아바타 + Messages 배지 */}
          <div className="relative flex-shrink-0 mt-0.5">
            <div
              className="w-[42px] h-[42px] rounded-full flex items-center justify-center text-white text-[17px] font-semibold"
              style={{ backgroundColor: avatarBg }}
            >
              {initial}
            </div>
            <div
              className="absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#34c759' }}
            >
              <svg viewBox="0 0 12 12" fill="white" style={{ width: 10, height: 10 }}>
                <path d="M1 1h10a1 1 0 011 1v6a1 1 0 01-1 1H4L1 12V2a1 1 0 011-1z"/>
              </svg>
            </div>
          </div>

          {/* 텍스트 영역 */}
          <div className="flex-1 min-w-0">
            {/* 발신자명 + 시각 */}
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[14px] font-semibold text-gray-900 truncate leading-tight">
                {message.sender}
              </p>
              <span className="text-[12px] text-gray-400 flex-shrink-0">{timeStr}</span>
            </div>

            {/* 스크리닝 결과 배지 */}
            <ScreenBadge result={screen} />

            {/* 메시지 본문 */}
            <p className="text-[13px] text-gray-600 leading-snug line-clamp-2 break-all">
              {before}
              {url && (
                <span className={`underline underline-offset-1 ${isDanger ? 'text-red-500' : 'text-blue-500'}`}>
                  {url}
                </span>
              )}
              {after}
            </p>
          </div>
        </div>
      </button>
    </div>
  )
}
