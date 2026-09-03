// 전화 수신 → 통화 중 → 종료까지 하나의 상단 pill로 이어지는 화면.
// 받아도 카드가 안 바뀌고, 받기/거절 버튼 자리만 통화 시간·음소거·종료로 바뀐다.
// 통화 중에 위로 슬라이드하면 아이폰 다이나믹 아일랜드처럼 작은 pill로 "흡수"되듯 접힌다 —
// 별도 컴포넌트로 순간 교체하는 게 아니라, 같은 카드의 너비·높이·둥근 정도를 실측 픽셀 값으로
// 함께 트랜지션해서 하나가 다른 하나로 줄어드는 것처럼 보이게 한다.

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { screenCall, screenCallImmediate, type CallScreenResult } from '../shared/callscreen'
import { pickRandomCallScript, type CallScript } from '../shared/callScript'
import { markCallScriptFlag } from '../shared/callActivity'

interface Props {
  call: { display: string; number: string; label: string }
  onEnd: () => void
  onPhaseChange?: (phase: 'ringing' | 'active') => void
}

const PHONE_PATH =
  'M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z'

const COLLAPSED_WIDTH = 148
const COLLAPSED_HEIGHT = 40
const MORPH = 'cubic-bezier(0.34, 1.15, 0.64, 1)'

function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const ss = String(s).padStart(2, '0')
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`
  return `${m}:${ss}`
}

// 자막 한 줄을 사람이 소리내어 읽는 속도와 비슷하게 단어 단위로 쪼갠다 — 각 단어에
// "지금까지 읽은 시간(delay)"을 매겨서, 그 시점에 그 단어만 투명→하양으로 페이드인되게 한다.
const READ_CHAR_MS = 70
const WORD_GAP_MS = 90
const SPACE_MS = 80
const LINE_HOLD_MS = 1000

interface TimedWord {
  text: string
  delay: number
}

function wordTimings(text: string): TimedWord[] {
  const tokens = text.split(/(\s+)/).filter((t) => t.length > 0)
  let acc = 0
  return tokens.map((token) => {
    const delay = acc
    acc += /\s/.test(token) ? SPACE_MS : token.length * READ_CHAR_MS + WORD_GAP_MS
    return { text: token, delay }
  })
}

function lineDurationMs(text: string): number {
  const timing = wordTimings(text)
  const last = timing.at(-1)
  return (last?.delay ?? 0) + LINE_HOLD_MS
}

export default function CallBanner({ call, onEnd, onPhaseChange }: Props) {
  const [phase, setPhase] = useState<'ringing' | 'active'>('ringing')
  const [collapsed, setCollapsed] = useState(false)
  const [visible, setVisible] = useState(false)
  const [result, setResult] = useState<CallScreenResult>(() => screenCallImmediate(call.number))
  const [ring, setRing] = useState(true)
  const [seconds, setSeconds] = useState(0)
  const [muted, setMuted] = useState(false)
  const dragStartY = useRef<number | null>(null)
  const draggingRef = useRef(false)
  // 드래그로 접힌 직후, 같은 손짓 끝에 브라우저가 합성해서 쏘는 click 하나를 무시한다 —
  // 안 그러면 "줄어들자마자 그 click이 펼치기 핸들러를 바로 건드려서" 다시 커져 보인다.
  const suppressClickRef = useRef(false)

  // 카드가 앉을 부모(은행 앱 컨테이너)의 실제 너비 — "펼친 상태" 폭을 픽셀로 알아야
  // "접힌 상태"(고정 148px)와 서로 트랜지션할 수 있다. width:auto는 애니메이션이 안 된다.
  const wrapRef = useRef<HTMLDivElement>(null)
  const [parentWidth, setParentWidth] = useState(414)
  useLayoutEffect(() => {
    const measure = () => {
      const w = wrapRef.current?.parentElement?.clientWidth
      if (w) setParentWidth(w)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // 펼친 내용의 실제 높이 — 위험 배너 유무 등으로 내용 높이가 달라지므로 매번 실측한다.
  const contentRef = useRef<HTMLDivElement>(null)
  const [expandedHeight, setExpandedHeight] = useState<number | null>(null)
  useLayoutEffect(() => {
    if (contentRef.current) setExpandedHeight(contentRef.current.scrollHeight)
  })

  // 슬라이드인
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 40)
    return () => clearTimeout(t)
  }, [])

  // 전화 벨 흔들림 — 수신 중일 때만
  useEffect(() => {
    if (phase !== 'ringing') return
    const id = setInterval(() => setRing((r) => !r), 700)
    return () => clearInterval(id)
  }, [phase])

  // 스크리닝
  useEffect(() => {
    let active = true
    setResult(screenCallImmediate(call.number))
    screenCall(call.number).then((next) => { if (active) setResult(next) })
    return () => { active = false }
  }, [call.number])

  // 통화 시간 — 응답한 뒤에만 증가
  useEffect(() => {
    if (phase !== 'active') return
    const id = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [phase])

  // 실제 녹취를 구할 수 없어(개인정보·저작권), 통화 중 대사를 자막으로 대신 보여준다.
  // 위험(danger) 통화를 받을 때마다 5가지 시나리오 중 하나를 무작위로 고르고, 한 줄씩
  // "사람이 읽는 속도"만큼 시간을 두고 다음 줄로 넘어간다. 각 줄에 달린 flags(이체한도
  // 상향 요구·적금 해지 요구·송금 요구)는 나올 때마다 callActivity에 기록해, 이체한도
  // 화면·적금 해지 화면·송금 화면이 나중에 그걸 참조할 수 있게 한다.
  const [script, setScript] = useState<CallScript | null>(null)
  const [scriptLineIdx, setScriptLineIdx] = useState(-1)
  // 한 번이라도 voiceClone 대사가 나오면, 그 뒤로는 계속 배지를 띄워둔다(다시 꺼지지 않음).
  const [voiceCloneWarning, setVoiceCloneWarning] = useState(false)
  useEffect(() => {
    if (phase !== 'active' || result.status !== 'danger') return
    const chosen = pickRandomCallScript()
    setScript(chosen)
    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []

    const showLine = (i: number) => {
      if (cancelled || i >= chosen.lines.length) return
      setScriptLineIdx(i)
      chosen.lines[i].flags?.forEach(markCallScriptFlag)
      if (chosen.lines[i].voiceClone) setVoiceCloneWarning(true)
      const t = setTimeout(() => showLine(i + 1), lineDurationMs(chosen.lines[i].text))
      timers.push(t)
    }
    showLine(0)

    return () => { cancelled = true; timers.forEach(clearTimeout) }
  }, [phase, result.status])

  const decline = () => {
    setVisible(false)
    setTimeout(onEnd, 280)
  }
  const answer = () => { setPhase('active'); onPhaseChange?.('active') }
  const hangUp = () => {
    setVisible(false)
    setTimeout(onEnd, 280)
  }

  const isSafe = result.status === 'safe'
  const isDanger = result.status === 'danger'
  const isRinging = phase === 'ringing'

  const circleBg = isSafe ? 'bg-[var(--ac-500)]' : isDanger ? 'bg-red-600' : 'bg-amber-500'
  const statusLabel = isSafe ? '공식 확인' : isDanger ? '위험 감지' : '추가 확인'
  const statusClass = isSafe
    ? 'border-emerald-400/30 bg-emerald-400/15 text-emerald-300'
    : isDanger
      ? 'border-red-400/35 bg-red-400/15 text-red-300'
      : 'border-amber-400/30 bg-amber-400/15 text-amber-300'

  // 위로 슬라이드하면 접힌다 — 통화 중일 때만 동작.
  // 포인터 캡처는 실제로 "드래그"가 확정된 뒤에만 건다 — 처음부터 잡아버리면 카드 안의
  // 종료·음소거 버튼을 살짝 눌러도 클릭이 카드로 가로채여 눌리지 않는 문제가 생긴다.
  const handlePointerDown = (e: React.PointerEvent) => {
    if (phase !== 'active' || collapsed) return
    dragStartY.current = e.clientY
    draggingRef.current = false
  }
  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragStartY.current === null) return
    const delta = dragStartY.current - e.clientY
    if (!draggingRef.current && Math.abs(delta) > 6) {
      draggingRef.current = true
      e.currentTarget.setPointerCapture?.(e.pointerId)
    }
    if (delta > 24) {
      setCollapsed(true)
      suppressClickRef.current = true
      dragStartY.current = null
      draggingRef.current = false
    }
  }
  const handlePointerUp = () => { dragStartY.current = null; draggingRef.current = false }

  const expandedLeft = 8
  const expandedWidth = Math.max(COLLAPSED_WIDTH, parentWidth - 16)
  const collapsedLeft = (parentWidth - COLLAPSED_WIDTH) / 2

  const capsuleWidth = collapsed ? COLLAPSED_WIDTH : expandedWidth
  const capsuleLeft = collapsed ? collapsedLeft : expandedLeft
  const capsuleHeight = collapsed ? COLLAPSED_HEIGHT : (expandedHeight ?? 92)
  const capsuleRadius = collapsed ? COLLAPSED_HEIGHT / 2 : 22
  const capsuleTop = visible ? 8 : -140

  return (
    <>
    {/* 휴대폰 알림이라 은행 앱 스크롤과 무관하게 화면 상단에 고정돼야 한다 — absolute를 쓰면
       은행 앱 컨테이너(스크롤되는 문서 흐름)를 기준으로 붙어서 스크롤하면 같이 밀려 올라간다.
       fixed + 뷰포트 중앙 정렬로, 폰 프레임 폭(max-w-430px) 안에서 진짜 상태바처럼 붙여둔다.
       캡슐 바깥은 pointer-events-none이라 은행 앱을 그대로 조작할 수 있다 */}
    <div ref={wrapRef} className="pointer-events-none fixed left-1/2 top-0 z-[100] w-full max-w-[430px] -translate-x-1/2">
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onClick={() => {
          if (suppressClickRef.current) { suppressClickRef.current = false; return }
          if (collapsed) setCollapsed(false)
        }}
        className={`pointer-events-auto absolute overflow-hidden border shadow-2xl ${isDanger ? 'border-red-400/35' : 'border-white/15'} ${phase === 'active' ? 'touch-none' : ''}`}
        style={{
          left: capsuleLeft,
          top: capsuleTop,
          width: capsuleWidth,
          height: capsuleHeight,
          borderRadius: capsuleRadius,
          background: 'rgba(20,20,22,0.96)',
          backdropFilter: 'blur(32px) saturate(140%)',
          WebkitBackdropFilter: 'blur(32px) saturate(140%)',
          boxShadow: '0 14px 38px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.08)',
          transition: `left 380ms ${MORPH}, top 300ms ${MORPH}, width 380ms ${MORPH}, height 380ms ${MORPH}, border-radius 320ms ${MORPH}`,
          cursor: collapsed ? 'pointer' : 'default',
        }}
        aria-label={collapsed ? '통화 화면 펼치기' : undefined}
      >
        {/* 접힌 pill 내용 — 다이나믹 아일랜드 미니 뷰 */}
        <div
          className="absolute inset-0 flex items-center justify-center gap-2.5 px-3.5 transition-opacity"
          style={{
            opacity: collapsed ? 1 : 0,
            pointerEvents: collapsed ? 'auto' : 'none',
            transitionDuration: collapsed ? '220ms' : '120ms',
            transitionDelay: collapsed ? '160ms' : '0ms',
          }}
        >
          <svg viewBox="0 0 24 24" fill="#4ade80" style={{ width: 14, height: 14, flexShrink: 0 }}>
            <path d={PHONE_PATH} />
          </svg>
          <span className="font-mono text-[13px] font-bold text-green-400 whitespace-nowrap">{formatDuration(seconds)}</span>
          <span className="flex items-end gap-[2px] h-3.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="w-[2.5px] rounded-full bg-white/70"
                style={{ height: '100%', animation: collapsed ? `call-wave ${0.6 + (i % 3) * 0.15}s ease-in-out infinite` : 'none', animationDelay: `${i * 90}ms` }}
              />
            ))}
          </span>
        </div>

        {/* 펼친 카드 내용 */}
        <div
          ref={contentRef}
          className="transition-opacity"
          style={{
            opacity: collapsed ? 0 : 1,
            pointerEvents: collapsed ? 'none' : 'auto',
            transitionDuration: collapsed ? '120ms' : '220ms',
            transitionDelay: collapsed ? '0ms' : '160ms',
          }}
        >
          <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.06] px-3 py-2">
            <div className="flex items-center gap-2">
              <img src="/ansim-ai-profile.png" alt="안심동행 AI" className="h-7 w-7 rounded-full border border-white/20 bg-white object-cover" />
              <div>
                <p className="flex items-center gap-1.5 text-[10px] font-extrabold text-[var(--ac-200)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--ac-300)]" />
                  {isRinging ? '안심동행 AI 발신자 확인' : `통화 중 · ${formatDuration(seconds)}`}
                </p>
                {isRinging && <p className="text-[8px] text-white/45">수신 전 자동 검증했어요</p>}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {result.international && (
                <span className="rounded-full border border-sky-400/30 bg-sky-400/15 px-2 py-0.5 text-[8px] font-bold text-sky-300">
                  🌐 국제전화
                </span>
              )}
              {voiceCloneWarning && (
                <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-400/15 px-2 py-0.5 text-[8px] font-bold text-fuchsia-300">
                  🎙️ AI 음성 변조 의심
                </span>
              )}
              <span className={`rounded-full border px-2 py-0.5 text-[8px] font-bold ${statusClass}`}>{statusLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-3 py-2.5">
            {/* 왼쪽: 상태 원 */}
            <div className={`relative w-[38px] h-[38px] rounded-full flex-shrink-0 flex items-center justify-center ${circleBg}`}>
              <svg
                viewBox="0 0 24 24"
                fill="white"
                style={{
                  width: 20,
                  height: 20,
                  transform: isRinging ? `rotate(${ring ? '12deg' : '-12deg'})` : 'none',
                  transition: 'transform 0.2s ease',
                }}
              >
                <path d={PHONE_PATH} />
              </svg>
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#3a3a3f] ${
                  isSafe ? 'bg-green-400' : isDanger ? 'bg-red-400' : 'bg-gray-400'
                }`}
              />
            </div>

            {/* 중앙: 검증 결과 + 번호 */}
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-extrabold tracking-wide leading-tight text-white truncate">
                {result.institutionName ?? call.display}
              </p>
              <p className={`mt-0.5 truncate text-[10px] font-semibold ${isDanger ? 'text-red-300' : isSafe ? 'text-emerald-300' : 'text-amber-300'}`}>
                {result.reason}{result.fsaVerified ? ' · 금융위 인증' : ''}
              </p>
              {result.institutionName && <p className="text-[9px] text-white/45">{call.display}</p>}
            </div>

            {/* 오른쪽: 수신 중엔 거부·수신, 통화 중엔 음소거·종료 */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {isRinging ? (
                <>
                  <button
                    onClick={decline}
                    className="w-[38px] h-[38px] rounded-full bg-red-500 flex items-center justify-center active:scale-90 transition-transform"
                    style={{ boxShadow: '0 2px 12px rgba(239,68,68,0.5)' }}
                    aria-label="거절"
                  >
                    <svg viewBox="0 0 24 24" fill="white" style={{ width: 18, height: 18, transform: 'rotate(135deg)' }}>
                      <path d={PHONE_PATH} />
                    </svg>
                  </button>
                  <button
                    onClick={answer}
                    className={`w-[38px] h-[38px] rounded-full flex items-center justify-center active:scale-90 transition-transform ${isDanger ? 'bg-amber-500' : 'bg-green-500'}`}
                    style={{ boxShadow: isDanger ? '0 2px 12px rgba(245,158,11,0.35)' : '0 2px 12px rgba(34,197,94,0.35)' }}
                    aria-label="수신"
                  >
                    <svg viewBox="0 0 24 24" fill="white" style={{ width: 18, height: 18 }}>
                      <path d={PHONE_PATH} />
                    </svg>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); setMuted((m) => !m) }}
                    className={`w-[38px] h-[38px] rounded-full flex items-center justify-center active:scale-90 transition-transform ${muted ? 'bg-white' : 'bg-white/15'}`}
                    aria-label={muted ? '음소거 해제' : '음소거'}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke={muted ? '#111827' : 'white'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                      <path d="M12 2a3 3 0 00-3 3v6a3 3 0 006 0V5a3 3 0 00-3-3z" />
                      <path d="M19 10v1a7 7 0 01-14 0v-1" />
                      <path d="M12 18v3" />
                      {muted && <path d="M3 3l18 18" />}
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); hangUp() }}
                    className="w-[38px] h-[38px] rounded-full bg-red-500 flex items-center justify-center active:scale-90 transition-transform"
                    style={{ boxShadow: '0 2px 12px rgba(239,68,68,0.5)' }}
                    aria-label="통화 종료"
                  >
                    <svg viewBox="0 0 24 24" fill="white" style={{ width: 18, height: 18, transform: 'rotate(135deg)' }}>
                      <path d={PHONE_PATH} />
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 상세 검증 정보 */}
          {isDanger && result.detail && (
            <div className="border-t border-red-400/20 bg-red-400/10 px-3 py-2">
              <p className="line-clamp-2 text-[10px] leading-snug text-red-200">
                {isRinging ? result.detail : '⚠ 통화 중 송금·계좌번호·인증번호를 요구받으면 절대 응하지 말고 바로 끊으세요.'}
              </p>
            </div>
          )}
          {isSafe && result.detail && (
            <div className="border-t border-emerald-400/20 bg-emerald-400/10 px-3 py-2">
              <p className="line-clamp-2 text-[10px] leading-snug text-emerald-200">{result.detail}</p>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* 실시간 캡션 스타일 자막 — 안드로이드 라이브 캡션처럼 화면 맨 아래, 옅은 회색
        배경에 하얀 글씨로 떠 있다. wrapRef 안에 넣으면 그 div의 transform(-translate-x-1/2)이
        새 containing block이 되어 이 자막의 fixed가 화면이 아니라 wrapRef 기준으로 붙어버려서,
        독립된 형제 엘리먼트로 뺐다. */}
    {phase === 'active' && script && scriptLineIdx >= 0 && (
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[95] w-full max-w-[430px] -translate-x-1/2 px-3">
        <div
          key={scriptLineIdx}
          className="rounded-2xl px-4 py-3 shadow-lg"
          style={{ background: 'rgba(120,120,128,0.72)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
        >
          <p className="text-[13px] font-medium leading-relaxed">
            {wordTimings(script.lines[scriptLineIdx].text).map((w, i) => (
              <span
                key={i}
                className={`opacity-0 [animation:caption-word-in_0.5s_ease-out_forwards] ${
                  script.lines[scriptLineIdx].flags?.length ? 'font-bold text-red-200' : 'text-white'
                }`}
                style={{ animationDelay: `${w.delay}ms` }}
              >
                {w.text}
              </span>
            ))}
          </p>
        </div>
      </div>
    )}
    </>
  )
}
