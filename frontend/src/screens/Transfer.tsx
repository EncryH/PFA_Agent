// 송금 화면 — 7단계 전부 여기서 관리한다.
//   input → account → amount → checking → (success | db-warning | ai-chat → hold)
//   already-sent 는 별도 진입 (골든타임 사후 대응)
//
// 송금 관련 상태는 전부 이 파일이 소유한다. App 은 페이지 전환만 안다.
// 자녀 앱과는 localStorage("ansimAlert") 로만 연결된다.

import { useState, useEffect, useRef, useMemo } from "react";
import { takeTurn, FIRST_QUESTION, type ChatMessage } from "../api/guardian";
import { BankAvatar, BankLogo, PageHeader, RECIPIENT_ICONS, shortBank } from "../shared/ui";
import {
  MY_ACCOUNTS, KNOWN_RECIPIENTS, BLACKLISTED_ACCOUNTS, BANKS, BROKERAGES, DEMO_ALERT, lookupHolder,
  fmtAccount, fmtAmt, parseAmt, runRisk, isMyAccount, nowTime,
  type TransferStep,
} from "../shared/data";
import { fetchRiskScore, type RiskResult } from "../api/riskScore";
import type { BehaviorSignals } from "../shared/behavior";

// ── 보안 분석 결과 카드 ─────────────────────────────────────────────────────
const GRADE_STYLE = {
  safe:    { bg: "bg-green-50",  border: "border-green-200",  text: "text-green-700",  badge: "bg-green-500"  },
  caution: { bg: "bg-amber-50",  border: "border-amber-200",  text: "text-amber-700",  badge: "bg-amber-500"  },
  warning: { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", badge: "bg-orange-500" },
  danger:  { bg: "bg-red-50",    border: "border-red-200",    text: "text-red-700",    badge: "bg-red-500"    },
} as const;

function RiskGradeCard({
  result, onProceed, freezeSecsLeft, onSkipFreeze,
}: {
  result: RiskResult;
  onProceed: () => void;
  freezeSecsLeft: number | null;
  onSkipFreeze: () => void;
}) {
  const s = GRADE_STYLE[result.gradeColor];
  const isHigh = result.grade === "C" || result.grade === "D";

  return (
    <div className="flex flex-col gap-3">
      <div className={`rounded-2xl border p-5 ${s.bg} ${s.border}`}>
        <p className="text-[13px] font-semibold text-gray-500 mb-3">🛡 안심동행 보안 분석 결과</p>

        {/* 등급 배지 + 점수 */}
        <div className="flex items-center gap-4 mb-4">
          <div className={`w-[60px] h-[60px] rounded-2xl ${s.badge} flex items-center justify-center`}>
            <span className="text-[32px] font-black text-white leading-none">{result.grade}</span>
          </div>
          <div>
            <p className={`text-[24px] font-black leading-tight ${s.text}`}>{result.gradeLabel}</p>
            <p className="text-[12px] text-gray-400">종합 위험 점수 {result.score}점 / 100점</p>
          </div>
        </div>

        {/* 점수 바 */}
        <div className="flex flex-col gap-2 mb-4">
          {[
            { label: "행동 분석", val: result.behaviorScore },
            { label: "거래 검사", val: result.transactionScore },
          ].map(({ label, val }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-[11px] text-gray-500 w-[60px] shrink-0">{label}</span>
              <div className="flex-1 h-1.5 bg-white rounded-full overflow-hidden">
                <div className={`h-full ${s.badge} rounded-full`} style={{ width: `${Math.min(100, val)}%` }} />
              </div>
              <span className="text-[11px] font-bold text-gray-600 w-7 text-right">{val}점</span>
            </div>
          ))}
        </div>

        {/* 감지 항목 */}
        {result.reasons.length > 0 && (
          <div className="flex flex-col gap-1">
            {result.reasons.map((r) => (
              <div key={r} className="flex items-center gap-1.5">
                <span className="text-[11px]">{isHigh ? "⚠" : "•"}</span>
                <span className={`text-[12px] font-medium ${s.text}`}>{r}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 액션 버튼 */}
      {result.grade === "A" ? (
        <div className="flex items-center justify-center gap-2 py-1.5 text-green-600">
          <div className="w-3.5 h-3.5 rounded-full border-2 border-green-300 border-t-green-600 animate-spin" />
          <span className="text-[13px]">안전 확인 — 송금을 진행합니다</span>
        </div>
      ) : result.grade === "B" ? (
        <button onClick={onProceed} className="w-full py-3.5 rounded-xl text-[15px] font-bold text-white bg-amber-500 active:scale-[0.98] transition-all">
          확인 후 송금하기
        </button>
      ) : result.grade === "C" ? (
        <>
          <button onClick={onProceed} className="w-full py-3.5 rounded-xl text-[15px] font-bold text-white bg-[var(--ac-500)] active:scale-[0.98] transition-all">
            AI와 거래 목적 확인하기
          </button>
          <p className="text-[12px] text-gray-400 text-center">위험 신호가 감지됐어요 — AI가 목적을 여쭤볼게요</p>
        </>
      ) : (
        /* D등급 — 5분 송금 정지 */
        freezeSecsLeft !== null && freezeSecsLeft > 0 ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[18px]">🔒</span>
              <span className="text-[14px] font-bold text-red-700">송금 5분 정지 중</span>
            </div>
            <div className="text-[52px] font-black text-red-600 font-mono tracking-[4px] leading-none">
              {String(Math.floor(freezeSecsLeft / 60)).padStart(2, "0")}:{String(freezeSecsLeft % 60).padStart(2, "0")}
            </div>
            <p className="text-[12px] text-red-500 text-center leading-relaxed">
              매우 높은 위험 신호가 감지됐어요.<br />지금 바로 가족에게 연락해 확인하세요.
            </p>
            <button onClick={onSkipFreeze} className="text-[11px] text-gray-400 underline underline-offset-2 active:scale-95 transition-transform">
              데모 건너뛰기 →
            </button>
          </div>
        ) : (
          <>
            <button onClick={onProceed} className="w-full py-3.5 rounded-xl text-[15px] font-bold text-white bg-[var(--ac-500)] active:scale-[0.98] transition-all">
              AI와 거래 목적 확인하기
            </button>
            <p className="text-[12px] text-gray-400 text-center">정지 해제됨 — AI가 거래 목적을 확인할게요</p>
          </>
        )
      )}
    </div>
  );
}

const TITLES: Record<TransferStep, string> = {
  input: "어디로 보낼까요?", account: "어떤 계좌로 보낼까요?", amount: "얼마를 보낼까요?",
  checking: "거래 분석 중", success: "송금 완료",
  "db-warning": "위험 계좌 감지", "ai-chat": "안심동행 AI 확인",
  hold: "확인 요청 중", "already-sent": "긴급 대응 ⚡",
};

export default function Transfer({
  onExit, accounts = MY_ACCOUNTS, behaviorSignals = { historyVisits: 0, verifyVisited: false }, onSuccess, defaultFromIdx = 0,
}: { onExit: () => void; accounts?: typeof MY_ACCOUNTS; behaviorSignals?: BehaviorSignals; onSuccess?: (fromIdx: number, amount: number, recipientName: string, toAccount: string) => void; defaultFromIdx?: number }) {
  const [step, setStep] = useState<TransferStep>("input");
  const [account, setAccount] = useState("");
  const [bank, setBank]       = useState("");
  const [name, setName]       = useState("");
  const [amt, setAmt]         = useState("");
  const [bankOpen, setBankOpen] = useState(false);
  const [bankTab, setBankTab] = useState<"은행" | "증권사">("은행");
  const [fromIdx, setFromIdx] = useState(defaultFromIdx);   // 출금 계좌 (탭하면 다음 계좌로 순환)

  // 키패드 입력 — 원본 숫자열을 다루고 표시만 콤마를 넣는다
  const pressKey = (k: string) => {
    const digits = amt.replace(/\D/g, "");
    setAmt(fmtAmt(k === "back" ? digits.slice(0, -1) : digits + k));
  };

  // AI 대화 상태
  const [messages, setMessages]   = useState<ChatMessage[]>([]);
  const [input, setInput]         = useState("");
  const [turnCount, setTurnCount] = useState(0);   // 부모님이 답한 횟수
  const [chatDone, setChatDone]   = useState(false);
  const [isTyping, setIsTyping]   = useState(false);
  const [fallback, setFallback]   = useState(false); // LLM 실패로 폴백 사용 중
  const [riskLabels, setRiskLabels] = useState<string[]>([]);
  const [goldenChecks, setGoldenChecks] = useState([false, false, false]);

  // 행동 감지 — Transfer 내부 신호
  const [backPresses, setBackPresses]   = useState(0);
  const [riskResult, setRiskResult]     = useState<RiskResult | null>(null);
  const [checkPhase, setCheckPhase]     = useState<"analyzing" | "result">("analyzing");
  const [analyzeStep, setAnalyzeStep]   = useState(0);
  const [freezeSecsLeft, setFreezeSecsLeft] = useState<number | null>(null);
  const sessionStartRef = useRef<number>(Date.now());

  const chatEndRef = useRef<HTMLDivElement>(null);
  const behaviorSignalsRef = useRef(behaviorSignals);
  behaviorSignalsRef.current = behaviorSignals; // 렌더마다 갱신 — 클로저 stale 방지
  const time = nowTime();

  // ── 실시간 위험 미리보기 (금액 입력 중) ──
  const liveRisk = useMemo(() => {
    const clean = account.replace(/\D/g, "");
    const value = parseAmt(amt);
    if (!clean && !value) return null;

    if (isMyAccount(account))
      return { label: "내 계좌", cls: "text-green-600 bg-green-50 border-green-100", msg: "본인 명의 계좌 — 확인 없이 바로 보내드려요" };

    if (BLACKLISTED_ACCOUNTS.some((b) => clean.length >= 7 && clean.includes(b.slice(0, 7))))
      return { label: "DB 경고", cls: "text-red-600 bg-red-50 border-red-100", msg: "신고된 계좌예요 — 즉시 차단됩니다" };

    const known = KNOWN_RECIPIENTS.find(
      (k) => (clean.length >= 8 && clean.includes(k.account.slice(0, 8))) || name === k.name
    );
    let score = 0;
    if (!known && clean.length >= 8) score += 25;
    if (value >= 300000) score += 10;
    if (value >= 1000000) score += 15;
    if (value >= 3000000) score += 20;

    if (score >= 35)
      return { label: "AI 확인 필요", cls: "text-amber-600 bg-amber-50 border-amber-100", msg: "새 계좌 + 고액 — AI가 송금 목적을 여쭤볼게요" };

    return { label: "정상", cls: "text-green-600 bg-green-50 border-green-100", msg: "정상 거래로 분석됩니다" };
  }, [account, amt, name]);

  // ── Effects ──
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // 계좌번호가 확정되면 예금주를 조회해 자동으로 채운다 (실제 은행 이체 흐름과 동일)
  useEffect(() => {
    if (step === "amount") setName(lookupHolder(account));
  }, [step, account]);

  // 계좌번호가 아는 수취인과 맞으면 은행·이름을 자동으로 채운다
  // (실서비스의 예금주 조회 자리 — 데모에서는 로컬 목록으로 대체)
  useEffect(() => {
    if (step !== "account") return;
    const clean = account.replace(/\D/g, "");
    if (clean.length < 8) return;
    const hit =
      MY_ACCOUNTS.find((m) => clean.includes(m.account.slice(0, 8))) ??
      KNOWN_RECIPIENTS.find((k) => clean.includes(k.account.slice(0, 8)));
    if (hit) { setBank(hit.bank); setName(hit.name); }
  }, [account, step]);

  // 분석 완료 → 행동 감지 + 거래 검사 → 등급 카드 표시
  useEffect(() => {
    if (step !== "checking") return;
    setCheckPhase("analyzing");
    setAnalyzeStep(0);
    setRiskResult(null);

    // 즉결 처리 (API 불필요)
    if (isMyAccount(account)) { setStep("success"); return; }
    const clean = account.replace(/\D/g, "");
    if (BLACKLISTED_ACCOUNTS.some((b) => clean.length >= 7 && clean.includes(b.slice(0, 7)))) {
      setStep("db-warning"); return;
    }

    // 분석 단계 애니메이션 (3단계 × 900ms)
    const pt1 = setTimeout(() => setAnalyzeStep(1), 900);
    const pt2 = setTimeout(() => setAnalyzeStep(2), 1800);

    const sessionSec = Math.floor((Date.now() - sessionStartRef.current) / 1000);
    const known = KNOWN_RECIPIENTS.find(
      (k) => (clean.length >= 8 && clean.includes(k.account.slice(0, 8))) || name === k.name,
    );
    const MIN_DISPLAY = 2700;
    const startTs = Date.now();

    const goAiChat = () => {
      setMessages([{ role: "ai", text: FIRST_QUESTION }]);
      setTurnCount(0); setChatDone(false);
      setStep("ai-chat");
    };

    fetchRiskScore({
      behavior: { ...behaviorSignalsRef.current, backPresses, sessionSeconds: sessionSec },
      transaction: {
        amount: parseAmt(amt),
        isKnownRecipient: !!known,
        isMyAccount: false,
        hourOfDay: new Date().getHours(),
      },
    }).then((result) => {
      const delay = Math.max(0, MIN_DISPLAY - (Date.now() - startTs));
      setTimeout(() => {
        setRiskResult(result);
        setCheckPhase("result");
        if (result.grade === "A") setTimeout(() => setStep("success"), 1500);
        else if (result.grade === "D") setFreezeSecsLeft(300); // 5분 정지
      }, delay);
    }).catch(() => {
      // API 장애 시 기존 로직으로 폴백
      const delay = Math.max(0, MIN_DISPLAY - (Date.now() - startTs));
      setTimeout(() => {
        const r = runRisk(account, parseAmt(amt), name);
        if (r === "success") setStep("success");
        else if (r === "db-warning") setStep("db-warning");
        else goAiChat();
      }, delay);
    });

    return () => { clearTimeout(pt1); clearTimeout(pt2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // D등급 5분 정지 카운트다운
  useEffect(() => {
    if (freezeSecsLeft === null || freezeSecsLeft <= 0) return;
    const t = setTimeout(() => setFreezeSecsLeft((s) => (s !== null ? s - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [freezeSecsLeft]);

  // D등급 카운트다운 종료 → 자동 홀드 (우회 불가)
  useEffect(() => {
    if (freezeSecsLeft !== 0 || riskResult?.grade !== "D") return;
    setRiskLabels((prev) => prev.length ? prev : (riskResult?.reasons ?? []));
    const t = setTimeout(() => setStep("hold"), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freezeSecsLeft]);

  // 송금 성공 시 잔액 차감 콜백
  useEffect(() => {
    if (step === "success") onSuccess?.(fromIdx, parseAmt(amt), name, account);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // hold 화면 도달 시 자녀 탭에 알림 공유
  useEffect(() => {
    if (step !== "hold") return;
    localStorage.setItem("ansimAlert", JSON.stringify({
      amount: parseAmt(amt),
      account: `${bank} ${account}`,
      bank,
      risk: "HIGH",
      signals: riskLabels.length ? riskLabels : DEMO_ALERT.signals,
      conversation: messages,
      time,
      _ts: Date.now(),
    }));
  }, [step]);

  // ── Handlers ──
  const reset = () => {
    setStep("input");
    setAccount(""); setBank(""); setName(""); setAmt(""); setBankOpen(false);
    setMessages([]); setInput(""); setTurnCount(0); setChatDone(false);
    setIsTyping(false); setFallback(false); setRiskLabels([]);
    setGoldenChecks([false, false, false]);
    setBackPresses(0); setRiskResult(null); setCheckPhase("analyzing"); setAnalyzeStep(0);
    setFreezeSecsLeft(null);
    sessionStartRef.current = Date.now();
  };

  const goHome = () => { reset(); onExit(); };

  /** 목록에서 계좌를 고르면 정보를 채우고 금액 화면으로 */
  const pick = (n: string, b: string, acc: string) => {
    setName(n); setBank(b); setAccount(fmtAccount(acc)); setStep("amount");
  };

  const accountReady = account.replace(/\D/g, "").length >= 8 && !!bank;
  const canSubmit = accountReady && parseAmt(amt) > 0;

  // 뒤로가기 — 단계별로 한 칸씩 (횟수는 행동 신호로 수집)
  const goBack = () => {
    setBackPresses((p) => p + 1);
    if (step === "account") { setStep("input"); setBankOpen(false); }
    else if (step === "amount") setStep("account");
    else goHome();
  };

  // 4층 AI 의도 분석 — Gemini가 질문·신호 추출, 규칙이 보류 판정
  const handleSend = async () => {
    if (!input.trim() || isTyping || chatDone) return;

    const history: ChatMessage[] = [...messages, { role: "user", text: input.trim() }];
    const turn = turnCount + 1;

    setMessages(history);
    setInput("");
    setTurnCount(turn);
    setIsTyping(true);

    const verdict = await takeTurn(
      { amount: parseAmt(amt), recipientName: name, account, bank },
      history,
      turn
    );

    setIsTyping(false);
    setFallback(verdict.fallback);
    if (verdict.risk.labels.length) setRiskLabels(verdict.risk.labels);
    setMessages((p) => [...p, { role: "ai", text: verdict.message }]);

    // 보류 여부는 서버의 규칙 엔진이 이미 판정했다.
    if (verdict.done) {
      setChatDone(true);
      setTimeout(() => setStep(verdict.hold ? "hold" : "success"), verdict.hold ? 2200 : 1600);
    }
  };

  // ══════════════════════════════════════════════════════════════════════
  return (
    <div className={`flex flex-col ${step === "amount" ? "gap-0" : "gap-4"}`}>
      {/* 금액 화면은 가운데 큰 글씨가 제목 역할을 하므로 뒤로가기만 둔다 */}
      {step === "amount" ? (
        <button onClick={goBack} className="w-9 h-9 -ml-1 flex items-center text-gray-500 active:scale-90 transition-transform">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
      ) : (
        <PageHeader title={TITLES[step]} onBack={goBack} />
      )}

      {/* ── 1단계: 어디로 보낼까요 ── */}
      {step === "input" && (
        <div className="flex flex-col gap-3">

          {/* 계좌번호 입력 → 전용 페이지로 */}
          <button
            onClick={() => setStep("account")}
            className="bg-white rounded-2xl px-5 py-4 flex items-center justify-between active:scale-[0.99] transition-transform"
          >
            <span className="text-[17px] text-gray-400">계좌번호 입력</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-gray-400">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>

          {/* 내 계좌 — 본인 명의라 검사 없이 통과 */}
          <div className="bg-white rounded-2xl px-5 py-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[13px] font-bold text-gray-400">내 계좌</p>
              <p className="text-[12px] text-gray-300">{accounts.length}개</p>
            </div>
            {accounts.map((m) => (
              <button key={m.account}
                onClick={() => pick(m.name, m.bank, m.account)}
                className="group w-full flex items-center gap-3.5 py-3 -mx-3 px-3 rounded-xl hover:bg-gray-50 active:scale-[0.98] transition-all duration-150">
                <span className="transition-transform duration-150 group-hover:scale-105">
                  <BankLogo bank={m.bank} size={30} />
                </span>
                <span className="flex-1 text-left min-w-0">
                  <span className="block text-[15px] font-bold text-gray-900">{m.name}</span>
                  <span className="block text-[13px] text-gray-400 truncate">{m.bank} {fmtAccount(m.account)}</span>
                </span>
                <span className="text-[13px] font-semibold text-gray-400 shrink-0">{m.balance}원</span>
              </button>
            ))}
          </div>

          {/* 최근 보낸 계좌 — 고르면 금액 화면으로 */}
          <div className="bg-white rounded-2xl px-5 py-4">
            <p className="text-[13px] font-bold text-gray-400 mb-1">최근 보낸 계좌</p>
            {KNOWN_RECIPIENTS.map((r) => (
              <button key={r.name}
                onClick={() => pick(r.name, r.bank, r.account)}
                className="group w-full flex items-center gap-3.5 py-3 -mx-3 px-3 rounded-xl hover:bg-gray-50 active:scale-[0.98] transition-all duration-150">
                <span className="transition-transform duration-150 group-hover:scale-105">
                  <BankAvatar bank={r.bank} name={r.name} size={30} icon={RECIPIENT_ICONS[r.name]} />
                </span>
                <span className="flex-1 text-left min-w-0">
                  <span className="block text-[15px] font-bold text-gray-900">{r.name}</span>
                  <span className="block text-[13px] text-gray-400 truncate">{r.bank} {fmtAccount(r.account)}</span>
                </span>
              </button>
            ))}
          </div>

          <button onClick={() => { setGoldenChecks([false, false, false]); setStep("already-sent"); }}
            className="w-full py-3 rounded-xl text-[14px] font-medium text-red-500 border border-red-200 bg-red-50 active:scale-[0.98] transition-all">
            이미 보냈어요 → 긴급 대응
          </button>
        </div>
      )}

      {/* ── 2단계: 계좌번호 + 은행 ── */}
      {step === "account" && (
        <div className="flex flex-col gap-5">
          <div className="bg-white rounded-2xl px-5 py-5">

            <label className="text-[12px] font-semibold text-gray-900 block mb-1">계좌번호</label>
            <input
              autoFocus
              value={account}
              onChange={(e) => setAccount(fmtAccount(e.target.value))}
              placeholder="- 없이 숫자만 입력"
              inputMode="numeric"
              className="w-full text-[20px] font-semibold tracking-wide placeholder:text-gray-300 placeholder:font-normal placeholder:tracking-normal focus:outline-none pb-2"
            />
            <div className="h-0.5 bg-[var(--ac-500)] rounded-full" />

            <button
              onClick={() => setBankOpen(!bankOpen)}
              className="w-full flex items-center justify-between pt-6 pb-2 active:scale-[0.99] transition-transform"
            >
              {bank ? (
                <span className="flex items-center gap-2.5">
                  <BankAvatar bank={bank} name={bank} size={26} label={bank.slice(0, 1)} />
                  <span className="text-[17px] font-semibold text-gray-900">{bank}</span>
                </span>
              ) : (
                <span className="text-[17px] text-gray-400">은행 선택</span>
              )}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className="w-5 h-5 text-gray-400">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            <div className="h-px bg-gray-200" />

            <p className="text-[12px] text-gray-400 mt-2.5">
              {bank ? "계좌를 확인했어요" : "계좌번호를 입력하면 은행을 찾아드릴게요"}
            </p>
          </div>

          <button
            onClick={() => setStep("amount")}
            disabled={!accountReady}
            className="w-full py-4 rounded-xl text-[16px] font-bold text-white bg-[var(--ac-500)] hover:bg-[var(--ac-600)] active:scale-[0.98] transition-all disabled:bg-gray-200 disabled:text-gray-400"
          >
            다음
          </button>

          {/* 은행 선택 바텀시트 — 아래에서 위로 */}
          {bankOpen && (
            <div className="fixed inset-0 z-50 flex flex-col justify-end">
              <button
                aria-label="닫기"
                onClick={() => setBankOpen(false)}
                className="absolute inset-0 bg-black/40"
                style={{ animation: "fade-in .2s ease-out" }}
              />
              <div
                className="relative mx-auto w-full max-w-[430px] bg-white rounded-t-3xl pb-6 max-h-[75vh] flex flex-col"
                style={{ animation: "sheet-up .28s cubic-bezier(.32,.72,0,1)" }}
              >
                <div className="flex items-center justify-between px-5 pt-5 pb-1 shrink-0">
                  <p className="text-[18px] font-bold text-gray-900">은행/증권사</p>
                  <button onClick={() => setBankOpen(false)} className="text-gray-400 active:scale-90 transition-transform">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-6 h-6">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex gap-5 px-5 border-b border-gray-100 shrink-0">
                  {(["은행", "증권사"] as const).map((t) => (
                    <button key={t} onClick={() => setBankTab(t)}
                      className={`text-[15px] font-bold pb-2.5 pt-2 border-b-2 transition-colors ${bankTab === t ? "text-gray-900 border-gray-900" : "text-gray-400 border-transparent"}`}>
                      {t}
                    </button>
                  ))}
                </div>
                <div className="overflow-y-auto px-3 pt-2 pb-2 grid grid-cols-2 gap-1">
                  {(bankTab === "은행" ? BANKS : BROKERAGES).map((b) => (
                    <button key={b} onClick={() => { setBank(b); setBankOpen(false); }}
                      className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all active:scale-[0.98] ${bank === b ? "bg-[var(--ac-50)]" : "hover:bg-gray-50"}`}>
                      <BankAvatar bank={b} name={b} size={26} label={b.slice(0, 1)} />
                      <span className="text-[15px] font-semibold text-gray-900 truncate">{shortBank(b)}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 3단계: 금액 ── */}
      {step === "amount" && (
        <div className="flex flex-col h-[calc(100dvh-188px)]">

          {/* 받는 분 — 예금주는 조회로 자동 표시, 아이콘은 은행 이름 왼쪽 */}
          <div className="flex flex-col items-center gap-1.5 pt-2 shrink-0">
            <p className="text-[17px] font-bold text-gray-900">{name || "받는 분"}</p>
            <button onClick={() => setStep("account")} className="flex items-center gap-1.5 active:scale-95 transition-transform">
              <BankAvatar bank={bank} name={bank} size={16} label={bank.slice(0, 1)} />
              <span className="text-[13px] text-gray-400 underline underline-offset-4 decoration-gray-300">{bank} {account}</span>
            </button>
          </div>

          {/* 금액 — 남는 세로 공간을 전부 차지한다 */}
          <div className="flex-1 min-h-[36px] flex items-center justify-center">
            <p className={`text-[30px] font-bold text-center ${amt ? "text-gray-900" : "text-gray-300"}`}>
              {amt ? `${amt}원` : "얼마를 보낼까요?"}
            </p>
          </div>

          {/* 출금 계좌 */}
          <button
            onClick={() => setFromIdx((i) => (i + 1) % accounts.length)}
            className="w-full bg-gray-50 rounded-xl px-4 py-3.5 flex items-center justify-between active:scale-[0.99] transition-transform"
          >
            <span className="flex items-center gap-2 min-w-0">
              <BankLogo bank={accounts[fromIdx].bank} size={18} />
              <span className="text-[14px] text-gray-500 truncate">
                {shortBank(accounts[fromIdx].bank)}({accounts[fromIdx].account.slice(-4)})
              </span>
            </span>
            <span className="flex items-center gap-1 shrink-0">
              <span className="text-[14px] font-semibold text-gray-900">{accounts[fromIdx].balance}원</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4 text-gray-400"><path d="M6 9l6 6 6-6" /></svg>
            </span>
          </button>

          {/* 빠른 금액 */}
          <div className="flex gap-1.5 mt-2 shrink-0">
            {[10000, 50000, 100000, 1000000].map((v) => (
              <button key={v} onClick={() => setAmt(fmtAmt(String(parseAmt(amt) + v)))}
                className="flex-1 py-2 rounded-lg border border-gray-200 text-[13px] font-medium text-gray-700 active:scale-95 transition-all">
                +{v / 10000}만
              </button>
            ))}
            <button onClick={() => setAmt(fmtAmt(accounts[fromIdx].balance))}
              className="flex-1 py-2 rounded-lg border border-gray-200 text-[13px] font-medium text-gray-700 active:scale-95 transition-all">
              전액
            </button>
          </div>

          {liveRisk && (
            <div className={`rounded-xl px-4 py-2 border flex items-center gap-2 mt-2 shrink-0 ${liveRisk.cls}`}>
              <div className="w-2 h-2 rounded-full bg-current opacity-60 shrink-0" />
              <div>
                <span className="text-[12px] font-bold">{liveRisk.label}</span>
                <span className="text-[12px] opacity-75 ml-2">{liveRisk.msg}</span>
              </div>
            </div>
          )}

          {/* 숫자 키패드 */}
          <div className="grid grid-cols-3 mt-2 shrink-0">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "back"].map((k) => (
              <button key={k} onClick={() => pressKey(k)}
                className="py-3 text-[23px] font-bold text-gray-900 rounded-xl active:bg-gray-100 transition-colors flex items-center justify-center">
                {k === "back"
                  ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
                  : k}
              </button>
            ))}
          </div>

          <button
            onClick={() => { if (canSubmit) setStep("checking"); }}
            disabled={!canSubmit}
            className="w-full py-3.5 mt-2 shrink-0 rounded-xl text-[16px] font-bold text-white bg-[var(--ac-500)] hover:bg-[var(--ac-600)] active:scale-[0.98] transition-all disabled:bg-gray-200 disabled:text-gray-400"
          >
            {canSubmit ? `${amt}원 보내기` : "다음"}
          </button>
        </div>
      )}

      {/* ── 분석 중 / 등급 결과 ── */}
      {step === "checking" && (
        checkPhase === "analyzing" ? (
          <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-6">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 rounded-full border-4 border-[var(--ac-100)]" />
              <div className="absolute inset-0 rounded-full border-4 border-[var(--ac-500)] border-t-transparent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="#3b82f6" className="w-8 h-8"><path d="M12 2L2 7.5v1h20v-1L12 2z" /><path d="M4.5 9h2v8h-2zM9 9h2v8H9zM13 9h2v8h-2zM17.5 9h2v8h-2z" /><path d="M2 17h20v2H2z" /></svg>
              </div>
            </div>
            <div className="text-center">
              <p className="text-[16px] font-bold text-gray-900">안심동행 AI 분석 중</p>
              <p className="text-[13px] text-gray-400 mt-1 font-mono">{account} · {amt}원</p>
            </div>
            <div className="w-full flex flex-col gap-1">
              {["행동 패턴 분석 중", "거래 이상 탐지 중", "안전 등급 산출 중"].map((s, i) => (
                <div key={s} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                  {analyzeStep > i ? (
                    <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><path d="M20 6L9 17l-5-5" /></svg>
                    </div>
                  ) : analyzeStep === i ? (
                    <div className="w-5 h-5 rounded-full bg-[var(--ac-100)] flex items-center justify-center shrink-0">
                      <div className="w-2 h-2 rounded-full bg-[var(--ac-400)] animate-pulse" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <div className="w-2 h-2 rounded-full bg-gray-300" />
                    </div>
                  )}
                  <p className={`text-[13px] ${analyzeStep >= i ? "text-gray-700" : "text-gray-300"}`}>{s}</p>
                </div>
              ))}
            </div>
          </div>
        ) : riskResult ? (
          <RiskGradeCard
            result={riskResult}
            freezeSecsLeft={freezeSecsLeft}
            onSkipFreeze={() => { setRiskLabels((prev) => prev.length ? prev : (riskResult?.reasons ?? [])); setStep("hold"); }}
            onProceed={() => {
              if (riskResult.grade === "A" || riskResult.grade === "B") {
                setStep("success");
              } else {
                setMessages([{ role: "ai", text: FIRST_QUESTION }]);
                setTurnCount(0); setChatDone(false);
                setStep("ai-chat");
              }
            }}
          />
        ) : null
      )}

      {/* ── 성공 ── */}
      {step === "success" && (
        <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-5">
          <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10"><path d="M20 6L9 17l-5-5" /></svg>
          </div>
          <div className="text-center">
            <p className="text-[12px] text-green-600 font-semibold mb-1">정상 거래 · 즉시 완료</p>
            <p className="text-[30px] font-bold text-gray-900">{amt}원</p>
            <p className="text-[14px] text-gray-400 mt-1">{name || "수취인"}님께 송금됐어요</p>
          </div>
          <div className="w-full bg-gray-50 rounded-xl p-4 flex flex-col gap-2 text-[13px]">
            {[
              ["수취인", name || "-"],
              ["계좌",   `${account}${bank ? ` (${bank})` : ""}`],
              ["금액",   `${amt}원`],
              ["처리",   "즉시 완료 (검사 생략)"],
              ["시각",   time],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-gray-400">{k}</span>
                <span className={`font-medium ${k === "처리" ? "text-green-600" : "text-gray-700"}`}>{v}</span>
              </div>
            ))}
          </div>
          <p className="text-[12px] text-gray-400 text-center leading-relaxed">기존 수취인 · 일반 금액 — 안심동행 AI가 무마찰 통과시켰어요</p>
          <button onClick={goHome} className="w-full py-3 rounded-xl text-[15px] font-semibold text-white bg-[var(--ac-500)] active:scale-[0.98] transition-all">홈으로</button>
        </div>
      )}

      {/* ── DB 경고 ── */}
      {step === "db-warning" && (
        <div className="flex flex-col gap-3">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" fill="#ef4444" className="w-5 h-5"><path d="M12 2L2 21h20L12 2zm0 3.5L19.5 19h-15L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z" /></svg>
              </div>
              <div>
                <p className="text-[15px] font-bold text-red-700">신고된 계좌입니다</p>
                <p className="text-[12px] text-red-400">더치트 DB 피해 신고 7건 확인됨</p>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 flex flex-col gap-2 text-[13px]">
              {[
                ["수취 계좌", account],
                ["은행",     bank || "-"],
                ["신고 건수","7건"],
                ["최근 신고","2026-07-31"],
                ["피해 유형","보이스피싱 사기"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-gray-400">{k}</span>
                  <span className={`font-medium ${k === "신고 건수" ? "font-bold text-red-600" : "text-gray-700"}`}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5">
            <p className="text-[14px] font-bold text-gray-900 mb-3">자녀에게 알렸어요</p>
            <div className="flex items-center gap-3 bg-[var(--ac-50)] rounded-xl p-3">
              <div className="w-9 h-9 rounded-full bg-[var(--ac-100)] flex items-center justify-center text-[13px] font-bold text-gray-900">지</div>
              <div><p className="text-[13px] font-medium text-gray-900">딸 지혜님께 알림 전송됨</p><p className="text-[11px] text-gray-400">방금 전</p></div>
            </div>
          </div>
          <button onClick={goHome} className="w-full py-3.5 rounded-xl text-[15px] font-semibold text-white bg-red-500 active:scale-[0.98] transition-all">보내지 않을게요</button>
          <button className="text-[13px] text-gray-400 text-center active:scale-95 py-1">그래도 보낼게요 (본인 책임)</button>
        </div>
      )}

      {/* ── AI 대화 ── */}
      {step === "ai-chat" && (
        <div className="flex flex-col gap-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="#f59e0b" className="w-4 h-4 shrink-0"><path d="M12 2L2 21h20L12 2zm0 3.5L19.5 19h-15L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z" /></svg>
              <p className="text-[12px] text-amber-700">신고 DB: <strong>이력 없음</strong> — 새 계좌 · 고액이라 AI가 확인해요</p>
            </div>
            {riskLabels.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pl-6">
                {riskLabels.map((l) => (
                  <span key={l} className="text-[11px] font-semibold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
                    {l}
                  </span>
                ))}
              </div>
            )}
            {fallback && (
              <p className="text-[11px] text-amber-600 pl-6">※ AI 연결이 불안정해 사전 정의 시나리오로 진행 중이에요</p>
            )}
          </div>
          <div className="bg-white rounded-2xl p-4 flex flex-col gap-3 min-h-[300px] max-h-[380px] overflow-y-auto">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "ai" && <div className="w-7 h-7 rounded-full bg-[var(--ac-100)] flex items-center justify-center mr-2 shrink-0 mt-0.5"><svg viewBox="0 0 24 24" fill="#3b82f6" className="w-4 h-4"><path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7z" /></svg></div>}
                <div className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-[13px] whitespace-pre-line leading-relaxed ${msg.role === "ai" ? "bg-[var(--ac-50)] text-gray-800 rounded-tl-sm" : "bg-[var(--ac-500)] text-white rounded-tr-sm"}`}>{msg.text}</div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="w-7 h-7 rounded-full bg-[var(--ac-100)] flex items-center justify-center mr-2 shrink-0"><svg viewBox="0 0 24 24" fill="#3b82f6" className="w-4 h-4"><path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7z" /></svg></div>
                <div className="bg-[var(--ac-50)] px-4 py-3 rounded-2xl rounded-tl-sm flex gap-1 items-center">
                  {[0, 150, 300].map((d) => <div key={d} className="w-2 h-2 rounded-full bg-[var(--ac-300)] animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          {!chatDone && (
            <div className="flex gap-2">
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSend()} placeholder="답변을 입력하세요..." disabled={isTyping}
                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-[14px] focus:border-[var(--ac-400)] focus:outline-none transition-colors disabled:bg-gray-50" />
              <button onClick={handleSend} disabled={!input.trim() || isTyping} className="w-12 h-12 rounded-xl bg-[var(--ac-500)] flex items-center justify-center active:scale-95 transition-transform disabled:bg-gray-200">
                <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z" /></svg>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── 홀드 ── */}
      {step === "hold" && (
        <div className="flex flex-col gap-3">
          <div className="bg-gradient-to-br from-[var(--ac-hero-from)] via-[var(--ac-hero-via)] to-[var(--ac-hero-to)] rounded-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 48 48" fill="white" fillOpacity="0.9" className="w-7 h-7"><circle cx="14" cy="12" r="4.5" /><path d="M14 17c-4 0-7 3-7 7v6h14v-6c0-4-3-7-7-7z" /><circle cx="34" cy="12" r="4.5" /><path d="M34 17c-4 0-7 3-7 7v6h14v-6c0-4-3-7-7-7z" /></svg>
              </div>
              <div>
                <p className="text-white font-bold text-[16px]">따님에게 확인을 요청했어요</p>
                <p className="text-white text-[12px] mt-0.5">차단이 아니에요 — 함께 확인하는 거예요</p>
              </div>
            </div>
            <div className="bg-white/15 rounded-xl p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between"><span className="text-white text-[12px]">위험도 판정</span><span className="bg-red-400 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">HIGH</span></div>
              <p className="text-white text-[13px]">{riskLabels.length ? riskLabels.join(" · ") + " 감지" : "위험 신호 감지"}</p>
              <p className="text-white text-[12px]">{amt}원 · {account}{bank ? ` · ${bank}` : ""}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5">
            <p className="text-[13px] font-bold text-gray-500 mb-3">자녀 화면 미리보기</p>
            <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0"><svg viewBox="0 0 24 24" fill="#ef4444" className="w-5 h-5"><path d="M12 2L2 21h20L12 2zm0 3.5L19.5 19h-15L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z" /></svg></div>
                <div>
                  <p className="text-[13px] font-bold text-gray-900">⚠️ 어머니 위험 거래 감지</p>
                  <p className="text-[12px] text-gray-500 mt-0.5">{amt}원 · {account}</p>
                  <p className="text-[12px] text-gray-400 mt-1">AI 분석: {riskLabels[0] || "위험 신호"} 탐지됨</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="flex-1 py-2 rounded-lg text-[12px] font-semibold text-white bg-[var(--ac-500)]">📞 전화하기</button>
                <button className="flex-1 py-2 rounded-lg text-[12px] font-semibold text-gray-900 border border-[var(--ac-200)] bg-[var(--ac-50)]">승인</button>
                <button className="flex-1 py-2 rounded-lg text-[12px] font-semibold text-red-600 border border-red-200 bg-red-50">보류</button>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0"><svg viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" className="w-4 h-4"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg></div>
            <div><p className="text-[13px] text-gray-700">30분 무응답 → 자동 24시간 지연</p><p className="text-[11px] text-gray-400">지연 자체가 방어 — 사기의 무기는 긴급성</p></div>
          </div>
          <button onClick={goHome} className="w-full py-3 rounded-xl text-[14px] font-semibold text-gray-500 border border-gray-200 bg-white active:scale-[0.98] transition-all">홈으로 돌아가기</button>
        </div>
      )}

      {/* ── 골든타임 ── */}
      {step === "already-sent" && (
        <div className="flex flex-col gap-3">
          <div className="bg-red-600 rounded-2xl p-5 text-white">
            <p className="text-[11px] font-bold text-red-200 mb-1 tracking-wide">⚡ 골든타임 — 지금 바로 행동하세요</p>
            <p className="text-[20px] font-bold">이미 보내셨나요?</p>
            <p className="text-[13px] text-red-100 mt-1">30분 이내 지급정지 신청 시 돌려받을 수 있어요</p>
          </div>
          <div className="bg-white rounded-2xl p-4">
            <p className="text-[13px] font-bold text-gray-700 mb-2">📋 전화할 때 이 정보를 알려주세요</p>
            <div className="bg-gray-50 rounded-xl p-3 flex flex-col gap-1.5 text-[12px]">
              {[
                ["수취 계좌", account || "직접 확인"],
                ["은행",     bank || "직접 확인"],
                ["금액",     amt ? `${amt}원` : "직접 확인"],
                ["시각",     time],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-gray-400">{k}</span>
                  <span className={`font-medium ${k === "금액" ? "font-bold text-red-600" : "text-gray-800"}`}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 flex flex-col gap-4">
            <p className="text-[14px] font-bold text-gray-900">지금 해야 할 일</p>
            {[
              { title: "① 한결은행 콜센터 지급정지 신청", desc: '"이체한 돈 지급정지 신청하고 싶어요"라고 말씀하세요', call: "1588-5000", urgent: true },
              { title: "② 경찰청 112 신고",             desc: "사건사고사실확인원 발급 요청 (환급 신청 필수 서류)", call: "112",       urgent: false },
              { title: "③ 금융감독원 피해 상담",        desc: "피해구제 절차 및 환급 신청 확인",                  call: "1332",      urgent: false },
            ].map((item, i) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-xl transition-all ${goldenChecks[i] ? "bg-green-50" : "bg-gray-50"}`}>
                <button onClick={() => setGoldenChecks((p) => p.map((v, idx) => idx === i ? !v : v))}
                  className={`w-6 h-6 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all ${goldenChecks[i] ? "bg-green-500 border-green-500" : "border-gray-300 bg-white"}`}>
                  {goldenChecks[i] && <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M20 6L9 17l-5-5" /></svg>}
                </button>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className={`text-[13px] font-bold ${goldenChecks[i] ? "text-green-700 line-through" : "text-gray-900"}`}>{item.title}</p>
                    {item.urgent && <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full ml-1 shrink-0">즉시</span>}
                  </div>
                  <p className="text-[11px] text-gray-400 mb-2 leading-relaxed">{item.desc}</p>
                  <a href={`tel:${item.call}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--ac-500)] text-white text-[12px] font-semibold rounded-lg active:scale-95 transition-transform">
                    <svg viewBox="0 0 24 24" fill="white" className="w-3.5 h-3.5"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" /></svg>
                    {item.call} 전화하기
                  </a>
                </div>
              </div>
            ))}
          </div>
          <button onClick={goHome} className="w-full py-3 rounded-xl text-[14px] font-medium text-gray-500 bg-white border border-gray-200 active:scale-[0.98] transition-all">홈으로</button>
        </div>
      )}
    </div>
  );
}
