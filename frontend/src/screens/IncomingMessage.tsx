// iOS 메시지 알림 배너 — 발신자 스크리닝 결과 포함

import { useEffect, useState } from 'react'
import type { DemoMessage } from '../shared/messages'
import { screenCall, type CallScreenResult } from '../shared/callscreen'
import { verifyUrl, type VerifyResult } from '../shared/verify'

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

// 링크 자체의 실시간 검사 상태를 URL 옆에 아이콘으로 표시한다.
function urlStatusIcon(result: VerifyResult | null): string {
  if (!result) return '⏳'
  if (result.status === 'safe') return '✅'
  if (result.status === 'danger') return '🚨'
  return '❓'
}

// 링크를 누르면 실제로 열리기 전에 검사 결과를 먼저 보여주는 확인 시트.
function LinkCheckSheet({ url, result, onClose }: { url: string; result: VerifyResult | null; onClose: () => void }) {
  const isDanger = result?.status === 'danger'
  const isSafe   = result?.status === 'safe'
  const color    = isDanger ? '#ef4444' : isSafe ? '#16a34a' : '#d97706'
  const bg       = isDanger ? 'bg-red-50' : isSafe ? 'bg-green-50' : 'bg-amber-50'
  const icon     = urlStatusIcon(result)

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center">
      <button
        type="button"
        aria-label="링크 검사 결과 닫기"
        onClick={onClose}
        className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
        style={{ animation: 'fade-in .18s ease-out' }}
      />
      <div
        className="relative w-full max-w-[430px] rounded-t-[28px] bg-white px-5 pb-8 pt-4 shadow-2xl"
        style={{ animation: 'sheet-up .24s cubic-bezier(.2,.8,.2,1)' }}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-gray-200" />

        <div className="mt-5 flex items-center gap-2.5">
          <span className={`flex h-9 w-9 items-center justify-center rounded-full ${bg} text-[16px]`}>{icon}</span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold" style={{ color }}>
              {result ? '누르기 전 실시간 검사 완료' : '검사 중…'}
            </p>
            <p className="text-[15px] font-bold text-gray-900">{result?.label ?? '분석 중입니다'}</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-3">
          <p className="break-all text-[12px] font-medium text-gray-500">{url}</p>
        </div>

        {result && (
          <p className="mt-3 text-[13px] leading-relaxed text-gray-600">{result.detail}</p>
        )}
        {result?.thecheat?.found && (
          <p className="mt-2 text-[12px] font-semibold text-red-500">
            더치트 신고 {result.thecheat.reportCount}건 · {result.thecheat.scamTypes.join(', ')}
          </p>
        )}

        {isDanger ? (
          <>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-red-600 text-[15px] font-bold text-white transition-all active:scale-[0.98]"
            >
              🚨 위험한 링크 — 열지 않기
            </button>
            <button
              type="button"
              onClick={() => { window.open(url, '_blank', 'noopener,noreferrer'); onClose() }}
              className="mt-2 w-full py-2 text-[12px] font-medium text-gray-300"
            >
              그래도 열기(권장하지 않음)
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className={`mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-bold text-white transition-all active:scale-[0.98] ${isSafe ? 'bg-green-600' : 'bg-amber-500'}`}
          >
            확인했어요
          </button>
        )}
      </div>
    </div>
  )
}

export default function IncomingMessage({ message, onDismiss }: Props) {
  const [visible, setVisible] = useState(false)
  const [screen, setScreen]   = useState<CallScreenResult | null>(null)
  const [urlCheck, setUrlCheck] = useState<VerifyResult | null>(null)
  const [linkSheetOpen, setLinkSheetOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 40)
    return () => clearTimeout(t)
  }, [])

  // 발신번호 스크리닝 (전화와 동일 로직)
  useEffect(() => {
    screenCall(message.number).then(setScreen)
  }, [message.number])

  // 본문 속 링크를 사용자가 누르기 전에 미리 검사해둔다 (Google Safe Browsing + 룰 베이스).
  useEffect(() => {
    if (!message.url) return
    verifyUrl(message.url).then(setUrlCheck)
  }, [message.url])

  // 5초 후 자동 닫힘 — 링크 검사 시트를 보는 중에는 배너가 먼저 사라지지 않게 멈춘다.
  useEffect(() => {
    if (linkSheetOpen) return
    const t = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 280)
    }, 5000)
    return () => clearTimeout(t)
  }, [onDismiss, linkSheetOpen])

  const dismiss = () => {
    setVisible(false)
    setTimeout(onDismiss, 280)
  }

  const isDanger = screen?.status === 'danger' || urlCheck?.status === 'danger'

  const initial   = message.sender.charAt(0).toUpperCase()
  const avatarBg  = senderColor(message.sender)
  const [before, url, after] = splitBody(message.body, message.url)

  const now     = new Date()
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  return (
    <>
    <div
      className={`absolute top-0 left-0 right-0 z-[100] px-3 pt-3 transition-transform duration-300 ease-out ${
        visible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={dismiss}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return
          e.preventDefault()
          dismiss()
        }}
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
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setLinkSheetOpen(true)
                  }}
                  className={`inline appearance-none border-0 bg-transparent p-0 m-0 align-baseline underline underline-offset-1 ${
                    urlCheck?.status === 'danger' ? 'text-red-500' : urlCheck?.status === 'safe' ? 'text-blue-500' : 'text-amber-600'
                  }`}
                  style={{ font: 'inherit' }}
                >
                  {urlStatusIcon(urlCheck)} {url}
                </button>
              )}
              {after}
            </p>
          </div>
        </div>
      </div>
    </div>

    {/* transform이 걸린 배너 컨테이너 밖에 둬야 fixed가 실제 뷰포트 기준으로 붙는다 —
        안쪽에 두면 슬라이드 애니메이션용 translate-y가 fixed의 containing block이 되어
        배너 높이만큼만 잘려 보인다. */}
    {linkSheetOpen && url && (
      <LinkCheckSheet url={url} result={urlCheck} onClose={() => setLinkSheetOpen(false)} />
    )}
    </>
  )
}
