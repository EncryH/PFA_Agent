// iOS 메시지 알림 배너 — 발신자 스크리닝 결과 포함

import { useEffect, useState } from 'react'
import type { DemoMessage } from '../shared/messages'
import { screenCall, screenCallImmediate, type CallScreenResult } from '../shared/callscreen'
import { verifyUrl, type VerifyResult } from '../shared/verify'

interface Props {
  message: DemoMessage
  onDismiss: () => void
}

function splitBody(body: string, url: string | null): [string, string, string] {
  if (!url) return [body, '', '']
  const idx = body.indexOf(url)
  if (idx === -1) return [body, '', '']
  return [body.slice(0, idx), url, body.slice(idx + url.length)]
}

// 스크리닝 결과 한 줄 배지
function ScreenBadge({ result }: { result: CallScreenResult }) {
  const isSafe   = result.status === 'safe'
  const isDanger = result.status === 'danger'

  const color  = isSafe ? 'text-emerald-300' : isDanger ? 'text-red-300' : 'text-white/55'
  const bgColor= isSafe ? 'bg-emerald-400/15' : isDanger ? 'bg-red-400/15' : 'bg-white/10'

  return (
    <div className={`my-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${bgColor}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${isSafe ? 'bg-green-500' : isDanger ? 'bg-red-500' : 'bg-gray-400'}`} />
      <span className={`text-[9px] font-semibold leading-tight ${color}`}>
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
  const [screen, setScreen]   = useState<CallScreenResult>(() => screenCallImmediate(message.number))
  const [urlCheck, setUrlCheck] = useState<VerifyResult | null>(null)
  const [linkSheetOpen, setLinkSheetOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 40)
    return () => clearTimeout(t)
  }, [])

  // 발신번호 스크리닝 (전화와 동일 로직)
  useEffect(() => {
    let active = true
    setScreen(screenCallImmediate(message.number))
    screenCall(message.number).then((next) => { if (active) setScreen(next) })
    return () => { active = false }
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

  const [before, url, after] = splitBody(message.body, message.url)

  const now     = new Date()
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  return (
    <>
    <div
      // 휴대폰 알림이라 은행 앱 스크롤과 무관하게 화면 상단에 고정돼야 한다 — absolute였을 땐
      // 은행 앱 컨테이너(스크롤되는 문서 흐름) 기준으로 붙어서 스크롤하면 같이 밀려 올라갔다.
      // fixed + 뷰포트 중앙 정렬로 폰 프레임 폭(max-w-430px) 안에서 진짜 상태바처럼 붙여둔다.
      className={`fixed left-1/2 top-0 z-[100] w-full max-w-[430px] px-2 pt-2 transition-transform duration-300 ease-out ${
        visible ? '-translate-x-1/2 translate-y-0' : '-translate-x-1/2 -translate-y-full'
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
          className={`rounded-[20px] border px-3 py-2.5 flex items-start gap-2.5 ${isDanger ? 'border-red-400/35' : 'border-white/15'}`}
          style={{
            background: 'rgba(64,64,70,0.94)',
            backdropFilter: 'blur(36px) saturate(140%)',
            WebkitBackdropFilter: 'blur(36px) saturate(140%)',
            boxShadow: isDanger
              ? '0 12px 38px rgba(239,68,68,0.2), inset 0 1px 0 rgba(255,255,255,0.08)'
              : '0 12px 38px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
        >
          {/* 안심동행 AI 프로필 */}
          <div className="relative flex-shrink-0 mt-0.5">
            <img src="/ansim-ai-profile.png" alt="안심동행 AI" className="h-9 w-9 rounded-full border border-white/20 bg-white object-cover shadow-sm" />
            <div
              className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--ac-500)] ring-2 ring-[#404046]"
            >
              <svg viewBox="0 0 12 12" fill="white" className="h-2.5 w-2.5">
                <path d="M1 1h10a1 1 0 011 1v6a1 1 0 01-1 1H4L1 12V2a1 1 0 011-1z"/>
              </svg>
            </div>
          </div>

          {/* 텍스트 영역 */}
          <div className="flex-1 min-w-0">
            {/* AI 확인 헤더 + 시각 */}
            <div className="flex items-baseline justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[10px] font-extrabold text-[var(--ac-200)] truncate leading-tight">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--ac-300)]" />
                안심동행 AI 문자 확인
              </p>
              <span className="text-[10px] text-white/40 flex-shrink-0">{timeStr}</span>
            </div>

            {urlCheck?.status === 'danger' ? (
              <div className="my-1 flex items-center justify-between gap-2 rounded-lg bg-red-400/15 px-2 py-1">
                <span className="flex items-center gap-1 text-[9px] font-extrabold text-red-200">
                  <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
                    <path d="M12 3l8 14H4L12 3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M12 8v4m0 2.5h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  위험 링크 감지
                </span>
                <span className="shrink-0 text-[8px] font-bold text-red-300">열지 마세요</span>
              </div>
            ) : (
              <ScreenBadge result={screen} />
            )}

            <p className="text-[12px] font-bold leading-tight text-white">{message.sender}</p>

            {/* 메시지 본문 */}
            <p className="mt-0.5 text-[11px] text-white/70 leading-snug line-clamp-2 break-all">
              {before}
              {url && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setLinkSheetOpen(true)
                  }}
                  className={`inline appearance-none border-0 bg-transparent p-0 m-0 align-baseline underline underline-offset-1 ${
                    urlCheck?.status === 'danger' ? 'text-red-300' : urlCheck?.status === 'safe' ? 'text-[var(--ac-200)]' : 'text-amber-300'
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
