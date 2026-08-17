// iOS 메시지 알림 배너 — 이미지 참고 (발신자사진·이름 제거, URL 강조)

import { useEffect, useState } from 'react'
import type { DemoMessage } from '../shared/messages'

interface Props {
  message: DemoMessage
  onDismiss: () => void
}

// 발신자 이니셜 → 원형 아바타 색상
function senderColor(sender: string): string {
  const colors = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
    '#10b981', '#06b6d4', '#6366f1', '#ef4444',
  ]
  let h = 0
  for (const c of sender) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return colors[Math.abs(h) % colors.length]
}

// 본문에서 URL 앞/URL/뒤 세 파트로 분리
function splitBody(body: string, url: string | null): [string, string, string] {
  if (!url) return [body, '', '']
  const idx = body.indexOf(url)
  if (idx === -1) return [body, '', '']
  return [body.slice(0, idx), url, body.slice(idx + url.length)]
}

export default function IncomingMessage({ message, onDismiss }: Props) {
  const [visible, setVisible] = useState(false)

  // 슬라이드인
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 40)
    return () => clearTimeout(t)
  }, [])

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

  const initial = message.sender.charAt(0).toUpperCase()
  const avatarBg = senderColor(message.sender)
  const [before, url, after] = splitBody(message.body, message.url)

  // 현재 시각 HH:MM
  const now = new Date()
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  return (
    <div
      className={`absolute top-0 left-0 right-0 z-[100] px-3 pt-3 transition-transform duration-300 ease-out ${
        visible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      {/* iOS 메시지 알림 카드 */}
      <button
        onClick={dismiss}
        className="w-full text-left"
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        <div
          className="rounded-[20px] px-4 py-3 flex items-start gap-3"
          style={{
            background: 'rgba(242,242,247,0.88)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.14), 0 1px 4px rgba(0,0,0,0.08)',
          }}
        >
          {/* 왼쪽: 아바타 + Messages 배지 */}
          <div className="relative flex-shrink-0 mt-0.5">
            {/* 아바타 원 (이미지의 인물사진 자리 — 이니셜로 대체) */}
            <div
              className="w-[42px] h-[42px] rounded-full flex items-center justify-center text-white text-[17px] font-semibold"
              style={{ backgroundColor: avatarBg }}
            >
              {initial}
            </div>
            {/* 초록 메시지 앱 배지 (이미지와 동일 위치) */}
            <div className="absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#34c759' }}>
              {/* 말풍선 아이콘 */}
              <svg viewBox="0 0 12 12" fill="white" style={{ width: 10, height: 10 }}>
                <path d="M1 1h10a1 1 0 011 1v6a1 1 0 01-1 1H4L1 12V2a1 1 0 011-1z"/>
              </svg>
            </div>
          </div>

          {/* 오른쪽: 발신자 + 시각 + 본문 */}
          <div className="flex-1 min-w-0">
            {/* 첫 줄: 발신자명 + 타임스탬프 */}
            <div className="flex items-baseline justify-between gap-2 mb-0.5">
              <p className="text-[14px] font-semibold text-gray-900 truncate leading-tight">
                {message.sender}
              </p>
              <span className="text-[12px] text-gray-400 flex-shrink-0">{timeStr}</span>
            </div>

            {/* 메시지 본문 (URL 강조) */}
            <p className="text-[13px] text-gray-600 leading-snug line-clamp-2 break-all">
              {before}
              {url && (
                <span className="text-blue-500 underline underline-offset-1">{url}</span>
              )}
              {after}
            </p>
          </div>
        </div>
      </button>
    </div>
  )
}
