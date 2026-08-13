import { useState, useEffect, useRef, useMemo } from "react";
import { takeTurn, FIRST_QUESTION, type ChatMessage } from "./api/guardian";

// ─── Types ────────────────────────────────────────────────────────────────
type Role = "parent" | "child";
type TransferStep = "input" | "checking" | "success" | "db-warning" | "ai-chat" | "hold" | "already-sent";

// ─── Transfer logic data ──────────────────────────────────────────────────
const KNOWN_RECIPIENTS = [
  { name: "딸 지혜",       account: "0102345678", bank: "국민은행", maxSafe: 1000000 },
  { name: "시장 상회",     account: "1103456789", bank: "농협",     maxSafe: 500000  },
  { name: "아파트 관리비", account: "0790123456", bank: "하나은행", maxSafe: 1000000 },
  { name: "약국",          account: "1105678901", bank: "국민은행", maxSafe: 200000  },
];

// 신고된 계좌 (더치트 DB 시뮬레이션)
const BLACKLISTED_ACCOUNTS = ["1104421783", "1104421"];

const BANKS = ["국민은행", "신한은행", "우리은행", "하나은행", "농협", "기업은행", "카카오뱅크", "토스뱅크"];

// ─── Helper functions ─────────────────────────────────────────────────────
const fmtAccount = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length <= 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 11)}-${d.slice(11)}`;
};

const fmtAmt = (v: string) => {
  const d = v.replace(/\D/g, "");
  return d ? parseInt(d).toLocaleString() : "";
};

const parseAmt = (v: string) => parseInt(v.replace(/,/g, ""), 10) || 0;

const runRisk = (account: string, amt: number, name: string): "success" | "db-warning" | "ai-chat" => {
  const clean = account.replace(/\D/g, "");

  if (BLACKLISTED_ACCOUNTS.some((b) => clean.length >= 7 && clean.includes(b.slice(0, 7))))
    return "db-warning";

  const known = KNOWN_RECIPIENTS.find(
    (k) => (clean.length >= 8 && clean.includes(k.account.slice(0, 8))) || name === k.name
  );

  if (known && amt > 0 && amt <= known.maxSafe) return "success";

  let score = 0;
  if (!known && clean.length >= 8) score += 25;
  if (amt >= 300000) score += 10;
  if (amt >= 1000000) score += 15;
  if (amt >= 3000000) score += 20;

  return score >= 35 ? "ai-chat" : "success";
};

// ─── Demo alert seed (자녀 화면용) ────────────────────────────────────────
const DEMO_ALERT = {
  parentName: "어머니 김영순",
  amount: 3000000,
  account: "기업 356-0912-4421-83",
  bank: "기업은행",
  risk: "HIGH",
  signals: ["선입금 모순", "기관 사칭", "긴급성 강요"],
  aiSummary: '"환급 수수료" 명목 — 구청 사칭 문자 후 송금 요청. 선입금 모순 탐지됨.',
  conversation: [
    { role: "ai",   text: "처음 보내는 계좌예요. 어떤 돈인지 여쭤봐도 될까요? 😊" },
    { role: "user", text: "환급 받으려면 수수료를 먼저 내야 한다고 해서요" },
    { role: "ai",   text: "구청이나 기관에서 연락을 받으신 건가요? 전화로 오셨나요, 문자로 오셨나요?" },
    { role: "user", text: "문자로 왔어요. 오늘까지라고 하더라고요" },
    { role: "ai",   text: "⚠️ 주의가 필요해요.\n환급을 받으려면 수수료를 먼저 내야 한다는 건 보이스피싱의 대표 수법이에요." },
  ],
  time: "오후 2:07",
};

// ─── Icons ────────────────────────────────────────────────────────────────
const parentTabs = ["홈", "금융", "상품", "혜택", "주식"] as const;
const childTabs  = ["홈", "알림", "설정"] as const;

const parentIcons: Record<string, React.ReactNode> = {
  홈:   <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M12 3C11.4 3 10.8 3.3 10.4 3.7L3.7 9.5C3.3 9.9 3 10.5 3 11.1V19c0 1.1.9 2 2 2h4.5v-6h5v6H19c1.1 0 2-.9 2-2v-7.9c0-.6-.3-1.2-.7-1.6l-6.7-5.8C13.2 3.3 12.6 3 12 3z" /></svg>,
  금융: <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><rect x="2" y="5" width="20" height="14" rx="2.5" /><rect x="2" y="9" width="20" height="3" fill="white" fillOpacity="0.3" /><circle cx="6" cy="15.5" r="1.5" fill="white" fillOpacity="0.5" /></svg>,
  상품: <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M4.5 8l1.5 12h12L19.5 8H4.5z" /><path d="M9 8V6a3 3 0 016 0v2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>,
  혜택: <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><rect x="3" y="10" width="18" height="3" rx="1" /><path d="M5 13v7c0 .6.4 1 1 1h12c.6 0 1-.4 1-1v-7" fillOpacity="0.3" /><rect x="11" y="10" width="2" height="11" /></svg>,
  주식: <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><rect x="4" y="14" width="3" height="7" rx="0.5" fillOpacity="0.4" /><rect x="8.5" y="11" width="3" height="10" rx="0.5" fillOpacity="0.6" /><rect x="13" y="8" width="3" height="13" rx="0.5" fillOpacity="0.8" /><rect x="17.5" y="5" width="3" height="16" rx="0.5" /></svg>,
};

const childIcons: Record<string, React.ReactNode> = {
  홈:   <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M12 3C11.4 3 10.8 3.3 10.4 3.7L3.7 9.5C3.3 9.9 3 10.5 3 11.1V19c0 1.1.9 2 2 2h4.5v-6h5v6H19c1.1 0 2-.9 2-2v-7.9c0-.6-.3-1.2-.7-1.6l-6.7-5.8C13.2 3.3 12.6 3 12 3z" /></svg>,
  알림: <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M12 2a1.5 1.5 0 011.5 1.5v.3A6 6 0 0118 9.5c0 3.5 1 5.5 2 7 .3.4 0 1-.5 1H4.5c-.5 0-.8-.6-.5-1 1-1.5 2-3.5 2-7a6 6 0 014.5-5.7v-.3A1.5 1.5 0 0112 2z" /><path d="M9.5 17.5a2.5 2.5 0 005 0" /></svg>,
  설정: <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z" /></svg>,
};

// ═════════════════════════════════════════════════════════════════════════
export default function App() {
  // ── 공통 ──
  const [role, setRole] = useState<Role>("parent");

  // ── 부모 앱 상태 ──
  const [pTab, setPTab]   = useState<typeof parentTabs[number]>("홈");
  const [page, setPage]   = useState<"home" | "guardian" | "transfer">("home");

  // 가족 연동 상태
  const [guardianStep, setGuardianStep] = useState<"intro" | "select" | "code" | "done">("intro");
  const [guardianRole, setGuardianRole] = useState<"parent" | "child" | null>(null);
  const [code, setCode]   = useState(["", "", "", ""]);

  // 송금 폼 상태
  const [transferStep, setTransferStep] = useState<TransferStep>("input");
  const [recipientAccount, setRecipientAccount] = useState("");
  const [recipientBank, setRecipientBank]       = useState("");
  const [recipientName, setRecipientName]       = useState("");
  const [transferAmt, setTransferAmt]           = useState("");

  // AI 대화 상태
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput]       = useState("");
  const [chatStage, setChatStage]       = useState(0);   // 부모님이 답한 횟수
  const [chatDone, setChatDone]         = useState(false);
  const [isAiTyping, setIsAiTyping]     = useState(false);
  const [aiFallback, setAiFallback]     = useState(false); // LLM 실패로 폴백 사용 중
  const [riskLabels, setRiskLabels]     = useState<string[]>([]);
  const [goldenChecks, setGoldenChecks] = useState([false, false, false]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const nowTime = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

  // ── 자녀 앱 상태 ──
  const [cTab, setCTab]         = useState<typeof childTabs[number]>("홈");
  const [childPage, setChildPage] = useState<"home" | "alert-detail">("home");
  const [alertResponse, setAlertResponse] = useState<"approved" | "held" | null>(null);
  const [childAlert, setChildAlert] = useState<typeof DEMO_ALERT | null>(() => {
    const stored = localStorage.getItem("ansimAlert");
    return stored ? { ...DEMO_ALERT, ...JSON.parse(stored) } : DEMO_ALERT;
  });

  // ── 실시간 위험 미리보기 (송금 입력 중) ──
  const liveRisk = useMemo(() => {
    const clean = recipientAccount.replace(/\D/g, "");
    const amt   = parseAmt(transferAmt);
    if (!clean && !amt) return null;

    if (BLACKLISTED_ACCOUNTS.some((b) => clean.length >= 7 && clean.includes(b.slice(0, 7))))
      return { label: "DB 경고", cls: "text-red-600 bg-red-50 border-red-100", msg: "신고된 계좌예요 — 즉시 차단됩니다" };

    const known = KNOWN_RECIPIENTS.find(
      (k) => (clean.length >= 8 && clean.includes(k.account.slice(0, 8))) || recipientName === k.name
    );
    let score = 0;
    if (!known && clean.length >= 8) score += 25;
    if (amt >= 300000) score += 10;
    if (amt >= 1000000) score += 15;
    if (amt >= 3000000) score += 20;

    if (score >= 35)
      return { label: "AI 확인 필요", cls: "text-amber-600 bg-amber-50 border-amber-100", msg: "새 계좌 + 고액 — AI가 송금 목적을 여쭤볼게요" };

    return { label: "정상", cls: "text-green-600 bg-green-50 border-green-100", msg: "정상 거래로 분석됩니다" };
  }, [recipientAccount, transferAmt, recipientName]);

  // ── Effects ──
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isAiTyping]);

  useEffect(() => {
    if (role !== "child") return;
    const id = setInterval(() => {
      const stored = localStorage.getItem("ansimAlert");
      if (stored) {
        const data = JSON.parse(stored);
        setChildAlert((prev) => ({ ...DEMO_ALERT, ...data, _ts: data._ts || (prev as any)?._ts }));
      }
    }, 1500);
    return () => clearInterval(id);
  }, [role]);

  // 분석 완료 → 다음 화면 결정
  useEffect(() => {
    if (transferStep !== "checking") return;
    const amt = parseAmt(transferAmt);
    const t = setTimeout(() => {
      const result = runRisk(recipientAccount, amt, recipientName);
      if (result === "success") {
        setTransferStep("success");
      } else if (result === "db-warning") {
        setTransferStep("db-warning");
      } else {
        setChatMessages([{ role: "ai", text: FIRST_QUESTION }]);
        setChatStage(0);
        setChatDone(false);
        setTransferStep("ai-chat");
      }
    }, 1800);
    return () => clearTimeout(t);
  }, [transferStep]);

  // hold 화면 도달 시 자녀 탭에 알림 공유
  useEffect(() => {
    if (transferStep !== "hold") return;
    const amt = parseAmt(transferAmt);
    localStorage.setItem("ansimAlert", JSON.stringify({
      amount: amt,
      account: `${recipientBank} ${recipientAccount}`,
      bank: recipientBank,
      risk: "HIGH",
      signals: riskLabels.length ? riskLabels : DEMO_ALERT.signals,
      conversation: chatMessages,
      time: nowTime,
      _ts: Date.now(),
    }));
  }, [transferStep]);

  // ── Handlers ──
  const resetTransfer = () => {
    setTransferStep("input");
    setRecipientAccount(""); setRecipientBank(""); setRecipientName(""); setTransferAmt("");
    setChatMessages([]); setChatInput(""); setChatStage(0); setChatDone(false);
    setIsAiTyping(false); setAiFallback(false); setRiskLabels([]);
    setGoldenChecks([false, false, false]);
  };

  const selectRecent = (r: typeof KNOWN_RECIPIENTS[number]) => {
    setRecipientName(r.name);
    setRecipientBank(r.bank);
    setRecipientAccount(fmtAccount(r.account));
  };

  const canSubmit = recipientAccount.replace(/\D/g, "").length >= 8 && parseAmt(transferAmt) > 0;

  // 4층 AI 의도 분석 — Gemini가 질문·신호 추출, 규칙이 보류 판정
  const handleChatSend = async () => {
    if (!chatInput.trim() || isAiTyping || chatDone) return;

    const msg = chatInput.trim();
    const history: ChatMessage[] = [...chatMessages, { role: "user", text: msg }];
    const turn = chatStage + 1;

    setChatMessages(history);
    setChatInput("");
    setChatStage(turn);
    setIsAiTyping(true);

    const verdict = await takeTurn(
      {
        amount: parseAmt(transferAmt),
        recipientName,
        account: recipientAccount,
        bank: recipientBank,
      },
      history,
      turn
    );

    setIsAiTyping(false);
    setAiFallback(verdict.fallback);
    if (verdict.risk.labels.length) setRiskLabels(verdict.risk.labels);
    setChatMessages((p) => [...p, { role: "ai", text: verdict.message }]);

    // 보류 여부는 서버의 규칙 엔진이 이미 판정했다.
    if (verdict.done) {
      setChatDone(true);
      setTimeout(() => setTransferStep(verdict.hold ? "hold" : "success"), verdict.hold ? 2200 : 1600);
    }
  };

  const transferTitle: Record<TransferStep, string> = {
    input: "송금", checking: "거래 분석 중", success: "송금 완료",
    "db-warning": "위험 계좌 감지", "ai-chat": "안심동행 AI 확인",
    hold: "확인 요청 중", "already-sent": "긴급 대응 ⚡",
  };

  // ─── 헤더 공용 ───────────────────────────────────────────────────────────
  const RoleToggle = () => (
    <button
      onClick={() => { setRole(role === "parent" ? "child" : "parent"); setChildPage("home"); setCTab("홈"); }}
      className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 active:scale-95 transition-transform"
    >
      {role === "parent" ? "👤 부모" : "👧 자녀"}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-3.5 h-3.5 opacity-60"><path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" /></svg>
    </button>
  );

  // ════════════════════════════════════════════════════════════════════════
  return (
    <div className="mx-auto min-h-dvh max-w-[430px] bg-[#fafbfe] flex flex-col">

      {/* ══════════════ PARENT APP ══════════════ */}
      {role === "parent" && (
        <>
          <header className="flex items-center justify-between px-5 py-4">
            <button onClick={() => { setPTab("홈"); setPage("home"); }} className="flex items-center gap-1.5 active:scale-95 transition-transform">
              <svg viewBox="0 0 24 24" fill="#2563eb" className="w-5 h-5"><path d="M12 2L2 7.5v1h20v-1L12 2z" /><path d="M4.5 9h2v8h-2zM9 9h2v8H9zM13 9h2v8h-2zM17.5 9h2v8h-2z" /><path d="M2 17h20v2H2z" /><circle cx="12" cy="5.2" r="0.8" fill="white" /></svg>
              <span className="text-[17px] font-bold text-blue-600 tracking-tight">안심은행</span>
            </button>
            <div className="flex gap-2 items-center">
              <button className="text-gray-400"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></svg></button>
              <button className="text-gray-400"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M12 2a1.5 1.5 0 011.5 1.5v.3A6 6 0 0118 9.5c0 3.5 1 5.5 2 7 .3.4 0 1-.5 1H4.5c-.5 0-.8-.6-.5-1 1-1.5 2-3.5 2-7a6 6 0 014.5-5.7v-.3A1.5 1.5 0 0112 2z" /><path d="M9.5 17.5a2.5 2.5 0 005 0" /></svg></button>
              <RoleToggle />
            </div>
          </header>

          <main className="flex-1 px-3 pb-4">

            {/* ── 송금 페이지 ── */}
            {page === "transfer" && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 py-2">
                  <button onClick={() => { setPage("home"); resetTransfer(); }} className="text-gray-500 active:scale-90 transition-transform">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M15 18l-6-6 6-6" /></svg>
                  </button>
                  <p className="text-[17px] font-bold text-gray-900">{transferTitle[transferStep]}</p>
                </div>

                {/* ── 입력 ── */}
                {transferStep === "input" && (
                  <div className="flex flex-col gap-3">

                    {/* 최근 수취인 */}
                    <div className="bg-white rounded-2xl p-4">
                      <p className="text-[12px] font-medium text-gray-400 mb-3">최근 수취인</p>
                      <div className="flex gap-2 flex-wrap">
                        {KNOWN_RECIPIENTS.map((r) => (
                          <button key={r.name} onClick={() => selectRecent(r)}
                            className={`px-3 py-1.5 rounded-full text-[13px] font-medium border transition-all active:scale-95 ${recipientName === r.name ? "bg-blue-500 text-white border-blue-500" : "bg-gray-50 text-gray-700 border-gray-200 hover:border-blue-300"}`}>
                            {r.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 폼 */}
                    <div className="bg-white rounded-2xl p-5 flex flex-col gap-4">

                      {/* 계좌번호 */}
                      <div>
                        <label className="text-[12px] font-medium text-gray-400 mb-1.5 block">계좌번호</label>
                        <input
                          value={recipientAccount}
                          onChange={(e) => setRecipientAccount(fmtAccount(e.target.value))}
                          placeholder="000-0000-0000"
                          inputMode="numeric"
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-[15px] font-mono tracking-wider focus:border-blue-400 focus:outline-none bg-white transition-colors"
                        />
                      </div>

                      {/* 은행 선택 */}
                      <div>
                        <label className="text-[12px] font-medium text-gray-400 mb-1.5 block">은행</label>
                        <div className="flex flex-wrap gap-1.5">
                          {BANKS.map((b) => (
                            <button key={b} onClick={() => setRecipientBank(b)}
                              className={`px-3 py-1 rounded-lg text-[12px] font-medium border transition-all active:scale-95 ${recipientBank === b ? "bg-blue-500 text-white border-blue-500" : "bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300"}`}>
                              {b}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 수취인 이름 */}
                      <div>
                        <label className="text-[12px] font-medium text-gray-400 mb-1.5 block">수취인 이름</label>
                        <input
                          value={recipientName}
                          onChange={(e) => setRecipientName(e.target.value)}
                          placeholder="홍길동"
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-[15px] focus:border-blue-400 focus:outline-none bg-white transition-colors"
                        />
                      </div>

                      {/* 금액 */}
                      <div>
                        <label className="text-[12px] font-medium text-gray-400 mb-1.5 block">금액</label>
                        <div className="relative">
                          <input
                            value={transferAmt}
                            onChange={(e) => setTransferAmt(fmtAmt(e.target.value))}
                            placeholder="0"
                            inputMode="numeric"
                            className="w-full px-4 py-3 pr-10 border border-gray-200 rounded-xl text-[18px] font-bold text-right focus:border-blue-400 focus:outline-none bg-white transition-colors"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[14px] text-gray-400 font-medium">원</span>
                        </div>
                        <div className="flex gap-1.5 mt-2">
                          {[10000, 50000, 100000, 500000, 1000000].map((v) => (
                            <button key={v} onClick={() => setTransferAmt(fmtAmt(String(parseAmt(transferAmt) + v)))}
                              className="flex-1 py-1.5 rounded-lg bg-gray-50 text-[11px] font-medium text-gray-600 border border-gray-100 hover:border-blue-200 active:scale-95 transition-all">
                              +{v >= 10000 ? `${v/10000}만` : v}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* 실시간 위험 미리보기 */}
                    {liveRisk && (
                      <div className={`rounded-xl px-4 py-3 border flex items-center gap-2 ${liveRisk.cls}`}>
                        <div className="w-2 h-2 rounded-full bg-current opacity-60 shrink-0" />
                        <div>
                          <span className="text-[12px] font-bold">{liveRisk.label}</span>
                          <span className="text-[12px] opacity-75 ml-2">{liveRisk.msg}</span>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => { if (canSubmit) setTransferStep("checking"); }}
                      disabled={!canSubmit}
                      className="w-full py-3.5 rounded-xl text-[15px] font-semibold text-white bg-blue-500 hover:bg-blue-600 active:scale-[0.98] transition-all disabled:bg-gray-200 disabled:text-gray-400"
                    >
                      {canSubmit ? "분석 후 송금" : "계좌번호와 금액을 입력하세요"}
                    </button>
                    <button onClick={() => { setGoldenChecks([false, false, false]); setTransferStep("already-sent"); }}
                      className="w-full py-3 rounded-xl text-[14px] font-medium text-red-500 border border-red-200 bg-red-50 active:scale-[0.98] transition-all">
                      이미 보냈어요 → 긴급 대응
                    </button>
                  </div>
                )}

                {/* ── 분석 중 ── */}
                {transferStep === "checking" && (
                  <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-6">
                    <div className="relative w-20 h-20">
                      <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
                      <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg viewBox="0 0 24 24" fill="#3b82f6" className="w-8 h-8"><path d="M12 2L2 7.5v1h20v-1L12 2z" /><path d="M4.5 9h2v8h-2zM9 9h2v8H9zM13 9h2v8h-2zM17.5 9h2v8h-2z" /><path d="M2 17h20v2H2z" /></svg>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-[16px] font-bold text-gray-900">거래를 분석하고 있어요</p>
                      <p className="text-[13px] text-gray-400 mt-1 font-mono">{recipientAccount} · {transferAmt}원</p>
                    </div>
                    <div className="w-full flex flex-col gap-1">
                      {["거래 패턴 확인 중", "신고 이력 DB 조회 중", "수취인 분석 중"].map((s) => (
                        <div key={s} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                          <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" /></div>
                          <p className="text-[13px] text-gray-500">{s}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── 성공 ── */}
                {transferStep === "success" && (
                  <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-5">
                    <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10"><path d="M20 6L9 17l-5-5" /></svg>
                    </div>
                    <div className="text-center">
                      <p className="text-[12px] text-green-600 font-semibold mb-1">정상 거래 · 즉시 완료</p>
                      <p className="text-[30px] font-bold text-gray-900">{transferAmt}원</p>
                      <p className="text-[14px] text-gray-400 mt-1">{recipientName || "수취인"}님께 송금됐어요</p>
                    </div>
                    <div className="w-full bg-gray-50 rounded-xl p-4 flex flex-col gap-2 text-[13px]">
                      {[
                        ["수취인", recipientName || "-"],
                        ["계좌",   `${recipientAccount}${recipientBank ? ` (${recipientBank})` : ""}`],
                        ["금액",   `${transferAmt}원`],
                        ["처리",   "즉시 완료 (검사 생략)"],
                        ["시각",   nowTime],
                      ].map(([k, v]) => (
                        <div key={k} className="flex justify-between">
                          <span className="text-gray-400">{k}</span>
                          <span className={`font-medium ${k === "처리" ? "text-green-600" : "text-gray-700"}`}>{v}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[12px] text-gray-400 text-center leading-relaxed">기존 수취인 · 일반 금액 — 안심동행 AI가 무마찰 통과시켰어요</p>
                    <button onClick={() => { setPage("home"); resetTransfer(); }} className="w-full py-3 rounded-xl text-[15px] font-semibold text-white bg-blue-500 active:scale-[0.98] transition-all">홈으로</button>
                  </div>
                )}

                {/* ── DB 경고 ── */}
                {transferStep === "db-warning" && (
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
                          ["수취 계좌", recipientAccount],
                          ["은행",     recipientBank || "-"],
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
                      <div className="flex items-center gap-3 bg-blue-50 rounded-xl p-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-[13px] font-bold text-blue-600">지</div>
                        <div><p className="text-[13px] font-medium text-gray-900">딸 지혜님께 알림 전송됨</p><p className="text-[11px] text-gray-400">방금 전</p></div>
                      </div>
                    </div>
                    <button onClick={() => { setPage("home"); resetTransfer(); }} className="w-full py-3.5 rounded-xl text-[15px] font-semibold text-white bg-red-500 active:scale-[0.98] transition-all">보내지 않을게요</button>
                    <button className="text-[13px] text-gray-400 text-center active:scale-95 py-1">그래도 보낼게요 (본인 책임)</button>
                  </div>
                )}

                {/* ── AI 대화 ── */}
                {transferStep === "ai-chat" && (
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
                      {aiFallback && (
                        <p className="text-[11px] text-amber-600 pl-6">※ AI 연결이 불안정해 사전 정의 시나리오로 진행 중이에요</p>
                      )}
                    </div>
                    <div className="bg-white rounded-2xl p-4 flex flex-col gap-3 min-h-[300px] max-h-[380px] overflow-y-auto">
                      {chatMessages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                          {msg.role === "ai" && <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center mr-2 shrink-0 mt-0.5"><svg viewBox="0 0 24 24" fill="#3b82f6" className="w-4 h-4"><path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7z" /></svg></div>}
                          <div className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-[13px] whitespace-pre-line leading-relaxed ${msg.role === "ai" ? "bg-blue-50 text-gray-800 rounded-tl-sm" : "bg-blue-500 text-white rounded-tr-sm"}`}>{msg.text}</div>
                        </div>
                      ))}
                      {isAiTyping && (
                        <div className="flex justify-start">
                          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center mr-2 shrink-0"><svg viewBox="0 0 24 24" fill="#3b82f6" className="w-4 h-4"><path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7z" /></svg></div>
                          <div className="bg-blue-50 px-4 py-3 rounded-2xl rounded-tl-sm flex gap-1 items-center">
                            {[0, 150, 300].map((d) => <div key={d} className="w-2 h-2 rounded-full bg-blue-300 animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>
                    {!chatDone && (
                      <div className="flex gap-2">
                        <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleChatSend()} placeholder="답변을 입력하세요..." disabled={isAiTyping}
                          className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-[14px] focus:border-blue-400 focus:outline-none transition-colors disabled:bg-gray-50" />
                        <button onClick={handleChatSend} disabled={!chatInput.trim() || isAiTyping} className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center active:scale-95 transition-transform disabled:bg-gray-200">
                          <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z" /></svg>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* ── 홀드 ── */}
                {transferStep === "hold" && (
                  <div className="flex flex-col gap-3">
                    <div className="bg-gradient-to-br from-blue-700 via-blue-500 to-cyan-400 rounded-2xl p-6 flex flex-col gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                          <svg viewBox="0 0 48 48" fill="white" fillOpacity="0.9" className="w-7 h-7"><circle cx="14" cy="12" r="4.5" /><path d="M14 17c-4 0-7 3-7 7v6h14v-6c0-4-3-7-7-7z" /><circle cx="34" cy="12" r="4.5" /><path d="M34 17c-4 0-7 3-7 7v6h14v-6c0-4-3-7-7-7z" /></svg>
                        </div>
                        <div>
                          <p className="text-white font-bold text-[16px]">따님에게 확인을 요청했어요</p>
                          <p className="text-blue-100 text-[12px] mt-0.5">차단이 아니에요 — 함께 확인하는 거예요</p>
                        </div>
                      </div>
                      <div className="bg-white/15 rounded-xl p-4 flex flex-col gap-2">
                        <div className="flex items-center justify-between"><span className="text-blue-100 text-[12px]">위험도 판정</span><span className="bg-red-400 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">HIGH</span></div>
                        <p className="text-white text-[13px]">{riskLabels.length ? riskLabels.join(" · ") + " 감지" : "위험 신호 감지"}</p>
                        <p className="text-blue-200 text-[12px]">{transferAmt}원 · {recipientAccount}{recipientBank ? ` · ${recipientBank}` : ""}</p>
                      </div>
                    </div>
                    <div className="bg-white rounded-2xl p-5">
                      <p className="text-[13px] font-bold text-gray-500 mb-3">자녀 화면 미리보기</p>
                      <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                        <div className="flex items-start gap-3 mb-4">
                          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0"><svg viewBox="0 0 24 24" fill="#ef4444" className="w-5 h-5"><path d="M12 2L2 21h20L12 2zm0 3.5L19.5 19h-15L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z" /></svg></div>
                          <div>
                            <p className="text-[13px] font-bold text-gray-900">⚠️ 어머니 위험 거래 감지</p>
                            <p className="text-[12px] text-gray-500 mt-0.5">{transferAmt}원 · {recipientAccount}</p>
                            <p className="text-[12px] text-gray-400 mt-1">AI 분석: 선입금 모순 탐지됨</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button className="flex-1 py-2 rounded-lg text-[12px] font-semibold text-white bg-blue-500">📞 전화하기</button>
                          <button className="flex-1 py-2 rounded-lg text-[12px] font-semibold text-blue-600 border border-blue-200 bg-blue-50">승인</button>
                          <button className="flex-1 py-2 rounded-lg text-[12px] font-semibold text-red-600 border border-red-200 bg-red-50">보류</button>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white rounded-2xl p-4 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0"><svg viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" className="w-4 h-4"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg></div>
                      <div><p className="text-[13px] text-gray-700">30분 무응답 → 자동 24시간 지연</p><p className="text-[11px] text-gray-400">지연 자체가 방어 — 사기의 무기는 긴급성</p></div>
                    </div>
                    <button onClick={() => { setPage("home"); resetTransfer(); }} className="w-full py-3 rounded-xl text-[14px] font-semibold text-gray-500 border border-gray-200 bg-white active:scale-[0.98] transition-all">홈으로 돌아가기</button>
                  </div>
                )}

                {/* ── 골든타임 ── */}
                {transferStep === "already-sent" && (
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
                          ["수취 계좌", recipientAccount || "직접 확인"],
                          ["은행",     recipientBank || "직접 확인"],
                          ["금액",     transferAmt ? `${transferAmt}원` : "직접 확인"],
                          ["시각",     nowTime],
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
                        { title: "① 안심은행 콜센터 지급정지 신청", desc: '"이체한 돈 지급정지 신청하고 싶어요"라고 말씀하세요', call: "1588-5000", urgent: true },
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
                            <a href={`tel:${item.call}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white text-[12px] font-semibold rounded-lg active:scale-95 transition-transform">
                              <svg viewBox="0 0 24 24" fill="white" className="w-3.5 h-3.5"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" /></svg>
                              {item.call} 전화하기
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => { setPage("home"); resetTransfer(); }} className="w-full py-3 rounded-xl text-[14px] font-medium text-gray-500 bg-white border border-gray-200 active:scale-[0.98] transition-all">홈으로</button>
                  </div>
                )}
              </div>
            )}

            {/* ── 안심동행 설정 ── */}
            {page === "guardian" && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 py-2">
                  <button onClick={() => { if (guardianStep === "select") setGuardianStep("intro"); else setPage("home"); }} className="text-gray-500 active:scale-90 transition-transform"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M15 18l-6-6 6-6" /></svg></button>
                  <p className="text-[17px] font-bold text-gray-900">안심동행 AI</p>
                </div>
                <div className="bg-gradient-to-br from-blue-700 via-blue-500 to-cyan-400 rounded-2xl p-4 flex items-center gap-4">
                  <svg viewBox="0 0 48 48" fill="white" fillOpacity="0.9" className="w-14 h-14 shrink-0"><circle cx="14" cy="12" r="4.5" /><path d="M14 17c-4 0-7 3-7 7v6h14v-6c0-4-3-7-7-7z" /><circle cx="34" cy="12" r="4.5" /><path d="M34 17c-4 0-7 3-7 7v6h14v-6c0-4-3-7-7-7z" /><circle cx="24" cy="20" r="3.5" /><path d="M24 24c-3 0-5.5 2.5-5.5 5.5V36h11v-6.5c0-3-2.5-5.5-5.5-5.5z" /></svg>
                  <div><p className="text-[17px] font-bold text-white">부모님 금융을 가족이 함께 지켜요</p><p className="text-[12px] text-blue-100 mt-1">AI가 이상 거래를 감지하고 가족에게 알려드려요</p></div>
                </div>
                {guardianStep === "intro" && (
                  <div className="flex flex-col gap-3">
                    <div className="bg-white rounded-2xl p-5">
                      <p className="text-[15px] font-bold text-gray-900">이렇게 지켜드려요</p>
                      <p className="text-[12px] text-gray-400 mt-1 mb-4">송금할 때 이 순서로 위험을 살펴봐요</p>
                      {[
                        {step:"1",title:"휴대폰부터 살펴봐요",desc:"몰래 조종하거나 은행을 흉내 낸 앱이 깔려 있는지 확인해요"},
                        {step:"2",title:"연락처가 진짜인지 확인해요",desc:"받으신 번호·문자·링크가 기관의 공식 연락처와 같은지 대조해요"},
                        {step:"3",title:"평소와 다른 움직임을 알아채요",desc:"잔액을 자꾸 확인하거나 적금을 깨는 등 낯선 흐름을 살펴요"},
                        {step:"4",title:"송금 내용을 살펴봐요",desc:"평소와 같으면 그대로 보내드리고, 다를 때만 한 번 더 확인해요"},
                        {step:"5",title:"왜 보내시는지 여쭤봐요",desc:"AI가 대화로 확인해요. 통화 중이시면 끊고 5분 뒤에 다시 안내해요"},
                        {step:"6",title:"혼자 결정하지 않게 도와드려요",desc:"알림만 받을지 함께 승인할지, 보호 단계는 부모님이 직접 고르세요"},
                        {step:"7",title:"피해를 입어도 되돌려요",desc:"지급정지·신고·피해구제 절차를 순서대로 안내해드려요"},
                      ].map((item) => (
                        <div key={item.step} className="flex items-start gap-3 mb-4 last:mb-0">
                          <div className="w-7 h-7 rounded-full bg-blue-500 text-white text-[13px] font-bold flex items-center justify-center shrink-0 mt-0.5">{item.step}</div>
                          <div><p className="text-[14px] font-semibold text-gray-900">{item.title}</p><p className="text-[12px] text-gray-400 mt-0.5">{item.desc}</p></div>
                        </div>
                      ))}
                      <div className="mt-5 pt-4 border-t border-gray-100 flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center shrink-0 mt-0.5"><svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M12 2v20M2 12h20" /></svg></div>
                        <div><p className="text-[14px] font-semibold text-gray-900">은행이 달라도 가족이 연결돼요</p><p className="text-[12px] text-gray-400 mt-0.5">부모님과 자녀분이 서로 다른 은행을 쓰셔도 함께 지켜드려요</p></div>
                      </div>
                    </div>
                    <div className="bg-white rounded-2xl p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                        <p className="text-[15px] font-bold text-gray-900">이건 꼭 약속드려요</p>
                      </div>
                      {[
                        {t:"자녀는 잔액과 거래내역을 볼 수 없어요",d:"어떤 단계를 고르셔도 통장 잔액, 어디에 쓰셨는지는 부모님만 보십니다"},
                        {t:"위험한 순간의 상황만 전달돼요",d:"\"처음 보는 곳에 큰 금액을 보내려 하십니다\" 정도만 자녀에게 알려요"},
                        {t:"언제든 그만두실 수 있어요",d:"보호 단계를 낮추거나 연결을 해제하는 것은 부모님 뜻대로예요"},
                      ].map((item) => (
                        <div key={item.t} className="flex items-start gap-3 mb-4 last:mb-0">
                          <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] shrink-0 mt-0.5"><path d="M20 6L9 17l-5-5" /></svg>
                          <div><p className="text-[14px] font-semibold text-gray-900">{item.t}</p><p className="text-[12px] text-gray-400 mt-0.5">{item.d}</p></div>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setGuardianStep("select")} className="w-full py-4 rounded-2xl text-[16px] font-semibold text-white bg-blue-500 active:scale-[0.98] transition-all">시작하기</button>
                  </div>
                )}
                {guardianStep === "select" && (
                  <div className="flex flex-col gap-3">
                    <p className="text-[15px] font-semibold text-gray-900 text-center mt-2">역할을 선택해주세요</p>
                    {[{r:"parent" as const,label:"부모님",desc:"AI와 자녀에게 안심동행 권한을 위임해요"},{r:"child" as const,label:"자녀",desc:"부모님 금융을 함께 지켜드려요"}].map((item) => (
                      <button key={item.r} onClick={() => { setGuardianRole(item.r); setGuardianStep("code"); }} className="bg-white rounded-2xl p-5 flex items-center gap-4 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all">
                        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center"><svg viewBox="0 0 32 32" fill="#3b82f6" className="w-7 h-7"><circle cx="16" cy="10" r="5" /><path d="M16 16c-5 0-9 3.5-9 8v2h18v-2c0-4.5-4-8-9-8z" /></svg></div>
                        <div className="text-left"><p className="text-[16px] font-bold text-gray-900">{item.label}</p><p className="text-[12px] text-gray-400">{item.desc}</p></div>
                      </button>
                    ))}
                  </div>
                )}
                {guardianStep === "code" && (
                  <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-5">
                    <p className="text-[15px] font-semibold text-gray-900">{guardianRole === "parent" ? "자녀에게 이 코드를 알려주세요" : "부모님의 연동 코드를 입력하세요"}</p>
                    <div className="flex gap-3">
                      {code.map((digit, i) => (
                        <input key={i} type="text" inputMode="numeric" maxLength={1} value={digit}
                          onChange={(e) => { const v = e.target.value.replace(/\D/, ""); const next = [...code]; next[i] = v; setCode(next); if (v && i < 3) (e.target.nextElementSibling as HTMLInputElement | null)?.focus(); }}
                          onKeyDown={(e) => { if (e.key === "Backspace" && !code[i] && i > 0) ((e.target as HTMLElement).previousElementSibling as HTMLInputElement | null)?.focus(); }}
                          className="w-14 h-14 text-center text-[24px] font-bold text-gray-900 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors" />
                      ))}
                    </div>
                    {guardianRole === "parent" && <p className="text-[28px] font-bold text-blue-600 tracking-[0.3em]">3 8 2 7</p>}
                    <button onClick={() => setGuardianStep("done")} disabled={guardianRole === "child" && code.some((d) => !d)} className="w-full py-3 rounded-xl text-[15px] font-semibold text-white bg-blue-500 active:scale-[0.98] transition-all disabled:bg-gray-200 disabled:text-gray-400">{guardianRole === "parent" ? "다음" : "연동하기"}</button>
                    <button onClick={() => { setGuardianStep("select"); setCode(["", "", "", ""]); }} className="text-[13px] text-gray-400 active:scale-95">이전으로</button>
                  </div>
                )}
                {guardianStep === "done" && (
                  <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center"><svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8"><path d="M20 6L9 17l-5-5" /></svg></div>
                    <p className="text-[17px] font-bold text-gray-900">연동 완료!</p>
                    <p className="text-[13px] text-gray-400 text-center whitespace-pre-line">{guardianRole === "parent" ? "딸 지혜님과 안심동행이 연결되었습니다.\n이제 AI가 이상 거래를 감지하면 자녀에게 알려드려요." : "어머니 김영순님과 안심동행이 연결되었습니다.\n부모님의 이상 거래를 함께 지켜볼 수 있어요."}</p>
                    <button onClick={() => { setPage("home"); setGuardianStep("intro"); setCode(["", "", "", ""]); }} className="w-full py-3 rounded-xl text-[15px] font-semibold text-white bg-blue-500 active:scale-[0.98] transition-all">홈으로 돌아가기</button>
                  </div>
                )}
              </div>
            )}

            {/* ── 홈 ── */}
            {page === "home" && pTab === "홈" && (
              <>
                <div className="bg-white rounded-2xl p-5 flex flex-col gap-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
                  {[
                    { name: "안심은행 입출금통장", balance: "1,250,000", icon: <svg viewBox="0 0 24 24" fill="#2563eb" className="w-4 h-4"><path d="M12 2L2 7.5v1h20v-1L12 2z" /><path d="M4.5 9h2v8h-2zM9 9h2v8H9zM13 9h2v8h-2zM17.5 9h2v8h-2z" /><path d="M2 17h20v2H2z" /></svg> },
                    { name: "토스뱅크 통장",       balance: "5,000,000", icon: <svg viewBox="0 0 24 24" className="w-4 h-4"><path d="M5 12h14M12 5v14" strokeWidth="3" stroke="#3182f6" fill="none" strokeLinecap="round" /></svg> },
                    { name: "신한 SOL 통장",        balance: "320,000",   icon: <svg viewBox="0 0 24 24" className="w-4 h-4"><text x="12" y="17" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#0046ff">S</text></svg> },
                  ].map((acc) => (
                    <div key={acc.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center bg-white border border-gray-200">{acc.icon}</div>
                        <div><p className="text-[13px] text-gray-500">{acc.name}</p><p className="text-[18px] font-bold text-gray-900">{acc.balance}원</p></div>
                      </div>
                      <button onClick={() => { resetTransfer(); setPage("transfer"); }} className="text-[13px] text-blue-500 bg-blue-50 rounded-md px-4 py-1.5 font-medium active:scale-95 hover:bg-blue-100 transition-all">송금</button>
                    </div>
                  ))}
                  <button className="text-[13px] text-gray-400 text-center pt-2 border-t border-gray-100">모두보기</button>
                </div>
                <div className="bg-white rounded-2xl p-5 mt-3 flex items-center justify-between hover:shadow-lg hover:-translate-y-0.5 transition-all">
                  <div><p className="text-[18px] font-bold text-gray-900">0원</p><p className="text-[13px] text-gray-400">9월 이용 금액</p></div>
                  <button className="text-[13px] text-gray-500 bg-gray-100 rounded-md px-4 py-1.5 font-medium">내역</button>
                </div>
                <div onClick={() => setPage("guardian")} className="mt-3 rounded-2xl p-6 bg-gradient-to-br from-blue-700 via-blue-500 to-cyan-400 flex items-center justify-between active:scale-[0.98] hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer">
                  <div><p className="text-[14px] font-semibold text-white mb-1">안심동행 AI</p><p className="text-[20px] text-blue-100 leading-snug">부모님 금융을<br />가족이 함께 지켜요</p><p className="text-[12px] text-blue-100 mt-2">시작하기 &gt;</p></div>
                  <svg viewBox="0 0 48 48" fill="white" fillOpacity="0.9" className="w-28 h-28"><circle cx="14" cy="12" r="4.5" /><path d="M14 17c-4 0-7 3-7 7v6h14v-6c0-4-3-7-7-7z" /><circle cx="34" cy="12" r="4.5" /><path d="M34 17c-4 0-7 3-7 7v6h14v-6c0-4-3-7-7-7z" /><circle cx="24" cy="20" r="3.5" /><path d="M24 24c-3 0-5.5 2.5-5.5 5.5V36h11v-6.5c0-3-2.5-5.5-5.5-5.5z" /></svg>
                </div>
                <div className="mt-3 bg-white rounded-2xl p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                  <p className="text-[14px] font-bold text-gray-900 mb-3">안심동행 현황</p>
                  <div className="flex justify-around text-center">
                    {[["127건","오늘 보호된 거래"],["99.2%","사기 탐지율"],["1.2초","평균 분석 속도"]].map(([v, l], i) => (
                      <div key={l} className={`${i > 0 ? "border-l border-gray-100 pl-4" : ""} flex-1`}><p className="text-[18px] font-bold text-blue-600">{v}</p><p className="text-[11px] text-gray-400 mt-0.5">{l}</p></div>
                    ))}
                  </div>
                </div>
                <div className="mt-3 bg-white rounded-2xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                  <p className="text-[16px] font-bold text-gray-900 mb-4">금융상품</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[{title:"안심 정기예금",desc:"연 3.5% · 12개월"},{title:"내일채움 적금",desc:"월 30만원부터"},{title:"안심 신용대출",desc:"최저 연 4.2%"},{title:"주택청약종합저축",desc:"비과세 · 소득공제"}].map((p) => (
                      <button key={p.title} className="bg-blue-50/60 rounded-xl p-4 text-left active:scale-95 hover:bg-blue-100/60 hover:-translate-y-0.5 hover:shadow-md transition-all"><p className="text-[14px] font-semibold text-blue-400">{p.title}</p><p className="text-[12px] text-gray-400 mt-1">{p.desc}</p></button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </main>

          <nav className="sticky bottom-0 bg-white rounded-[28px] flex justify-around py-2 pt-3 mt-4">
            {parentTabs.map((t) => (
              <button key={t} onClick={() => setPTab(t)} className={`flex flex-col items-center gap-1 text-[11px] py-1 px-3 ${pTab === t ? "text-blue-500 font-semibold" : "text-gray-400"}`}>
                {parentIcons[t]}{t}
              </button>
            ))}
          </nav>
        </>
      )}

      {/* ══════════════ CHILD APP ══════════════ */}
      {role === "child" && (
        <>
          <header className="flex items-center justify-between px-5 py-4 bg-white border-b border-gray-100">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="#2563eb" className="w-5 h-5"><path d="M12 2L2 7.5v1h20v-1L12 2z" /><path d="M4.5 9h2v8h-2zM9 9h2v8H9zM13 9h2v8h-2zM17.5 9h2v8h-2z" /><path d="M2 17h20v2H2z" /></svg>
              <span className="text-[17px] font-bold text-blue-600 tracking-tight">안심은행</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <svg viewBox="0 0 24 24" fill="#6b7280" className="w-6 h-6"><path d="M12 2a1.5 1.5 0 011.5 1.5v.3A6 6 0 0118 9.5c0 3.5 1 5.5 2 7 .3.4 0 1-.5 1H4.5c-.5 0-.8-.6-.5-1 1-1.5 2-3.5 2-7a6 6 0 014.5-5.7v-.3A1.5 1.5 0 0112 2z" /><path d="M9.5 17.5a2.5 2.5 0 005 0" /></svg>
                {childAlert && !alertResponse && <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center"><span className="text-[9px] font-bold text-white">1</span></div>}
              </div>
              <RoleToggle />
            </div>
          </header>

          <main className="flex-1 px-3 pb-4 overflow-y-auto">
            {cTab === "홈" && childPage === "home" && (
              <div className="flex flex-col gap-3 pt-4">
                <div className="flex items-center justify-between">
                  <div><p className="text-[13px] text-gray-400">안녕하세요</p><p className="text-[20px] font-bold text-gray-900">김지혜님 👋</p></div>
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-[16px] font-bold text-blue-600">지</div>
                </div>
                {childAlert && !alertResponse ? (
                  <button onClick={() => setChildPage("alert-detail")} className="w-full bg-red-50 border-2 border-red-200 rounded-2xl p-5 text-left active:scale-[0.98] hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center"><svg viewBox="0 0 24 24" fill="#ef4444" className="w-4 h-4"><path d="M12 2L2 21h20L12 2zm0 3.5L19.5 19h-15L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z" /></svg></div>
                        <span className="text-[13px] font-bold text-red-700">확인이 필요해요</span>
                      </div>
                      <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">HIGH</span>
                    </div>
                    <p className="text-[15px] font-bold text-gray-900 mb-1">어머니 위험 거래 감지</p>
                    <p className="text-[13px] text-gray-600">{(childAlert as any).amount?.toLocaleString?.() || "3,000,000"}원 → {(childAlert as any).account || "기업 356-0912-4421-83"}</p>
                    <p className="text-[12px] text-gray-400 mt-1">AI가 모순을 감지했어요</p>
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-[12px] text-red-500 font-semibold">자세히 보기 →</p>
                      <p className="text-[11px] text-gray-400">{(childAlert as any).time || DEMO_ALERT.time}</p>
                    </div>
                  </button>
                ) : alertResponse ? (
                  <div className={`rounded-2xl p-5 ${alertResponse === "held" ? "bg-amber-50 border border-amber-200" : "bg-green-50 border border-green-200"}`}>
                    <p className={`text-[14px] font-bold mb-1 ${alertResponse === "held" ? "text-amber-700" : "text-green-700"}`}>{alertResponse === "held" ? "⏸ 보류 처리됨" : "✅ 승인 처리됨"}</p>
                    <p className="text-[12px] text-gray-500">어머니의 송금이 {alertResponse === "held" ? "24시간 지연되었어요" : "승인되었어요"}.</p>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
                    <div className="flex items-center gap-2"><svg viewBox="0 0 24 24" fill="#22c55e" className="w-5 h-5"><path d="M20 6L9 17l-5-5" /></svg><p className="text-[14px] font-bold text-green-700">이번 주 이상 없어요</p></div>
                    <p className="text-[12px] text-gray-400 mt-1">어머니의 거래가 모두 정상이에요 ✅</p>
                  </div>
                )}
                <div className="bg-white rounded-2xl p-5">
                  <p className="text-[13px] font-bold text-gray-400 mb-3">연결된 부모님</p>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-[18px] font-bold text-blue-400">영</div>
                    <div className="flex-1"><p className="text-[15px] font-bold text-gray-900">어머니 김영순</p><p className="text-[12px] text-gray-400 mt-0.5">권한 레벨 Lv.2 · 공동 확인</p></div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-400" /><p className="text-[11px] text-gray-400">연결됨</p></div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-50 grid grid-cols-2 gap-2 text-center text-[12px]">
                    <div><p className="font-bold text-gray-800">Lv.2</p><p className="text-gray-400">위임 권한</p></div>
                    <div><p className="font-bold text-gray-800">2026-07-28</p><p className="text-gray-400">연동일</p></div>
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3"><p className="text-[14px] font-bold text-gray-900">주간 안심 리포트</p><p className="text-[11px] text-gray-400">2026.08.05 ~ 08.11</p></div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[["127건","정상 거래","text-blue-600"],["1건","위험 탐지","text-red-500"],["0건","피해 발생","text-green-600"]].map(([v, l, c]) => (
                      <div key={l} className="bg-gray-50 rounded-xl p-3"><p className={`text-[18px] font-bold ${c}`}>{v}</p><p className="text-[10px] text-gray-400 mt-0.5">{l}</p></div>
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-3 text-center">잔액·거래내역은 비공개 · 이상 유무만 알림</p>
                </div>
              </div>
            )}

            {cTab === "홈" && childPage === "alert-detail" && childAlert && (
              <div className="flex flex-col gap-3 pt-2">
                <div className="flex items-center gap-3 py-2">
                  <button onClick={() => setChildPage("home")} className="text-gray-500 active:scale-90"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M15 18l-6-6 6-6" /></svg></button>
                  <p className="text-[17px] font-bold text-gray-900">위험 이벤트 상세</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3"><p className="text-[15px] font-bold text-red-700">⚠️ 어머니 위험 거래 감지</p><span className="bg-red-500 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">HIGH</span></div>
                  <div className="bg-white rounded-xl p-4 flex flex-col gap-2 text-[13px]">
                    {[["금액", `${((childAlert as any).amount || 3000000).toLocaleString()}원`], ["수취 계좌", (childAlert as any).account || DEMO_ALERT.account], ["수취 은행", (childAlert as any).bank || DEMO_ALERT.bank], ["시각", (childAlert as any).time || DEMO_ALERT.time]].map(([k, v]) => (
                      <div key={k} className="flex justify-between"><span className="text-gray-400">{k}</span><span className={`font-medium ${k === "금액" ? "font-bold text-red-600" : "text-gray-800"}`}>{v}</span></div>
                    ))}
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-5">
                  <p className="text-[13px] font-bold text-gray-700 mb-3">AI 분석 결과</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {DEMO_ALERT.signals.map((s) => <span key={s} className="bg-red-50 text-red-600 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-red-100">{s}</span>)}
                  </div>
                  <p className="text-[12px] text-gray-500 leading-relaxed bg-gray-50 rounded-xl p-3">{DEMO_ALERT.aiSummary}</p>
                </div>
                <div className="bg-white rounded-2xl p-5">
                  <p className="text-[13px] font-bold text-gray-700 mb-3">AI · 어머니 대화 내용</p>
                  <div className="flex flex-col gap-2">
                    {DEMO_ALERT.conversation.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        {msg.role === "ai" && <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center mr-2 shrink-0 mt-0.5"><svg viewBox="0 0 24 24" fill="#3b82f6" className="w-3.5 h-3.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7z" /></svg></div>}
                        <div className={`max-w-[80%] px-3 py-2 rounded-xl text-[12px] whitespace-pre-line leading-relaxed ${msg.role === "ai" ? "bg-blue-50 text-gray-800 rounded-tl-sm" : "bg-gray-100 text-gray-700 rounded-tr-sm"}`}>{msg.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {!alertResponse ? (
                  <div className="flex flex-col gap-2">
                    <a href="tel:010-0000-0000" className="w-full py-3.5 rounded-xl text-[15px] font-semibold text-white bg-blue-500 active:scale-[0.98] transition-all text-center block">📞 어머니께 전화하기</a>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => { setAlertResponse("approved"); setChildPage("home"); localStorage.removeItem("ansimAlert"); }} className="py-3 rounded-xl text-[14px] font-semibold text-blue-600 border-2 border-blue-200 bg-blue-50 active:scale-[0.98] transition-all">✅ 승인</button>
                      <button onClick={() => { setAlertResponse("held"); setChildPage("home"); localStorage.removeItem("ansimAlert"); }} className="py-3 rounded-xl text-[14px] font-semibold text-red-600 border-2 border-red-200 bg-red-50 active:scale-[0.98] transition-all">⏸ 보류</button>
                    </div>
                    <p className="text-[11px] text-gray-400 text-center">승인 시 어머니 최종 확인 후 송금 / 보류 시 24시간 지연</p>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
                    <p className="text-[15px] font-bold text-green-700">{alertResponse === "held" ? "보류 처리 완료" : "승인 완료"}</p>
                    <p className="text-[12px] text-gray-500 mt-1">어머니께 결과가 전달되었어요</p>
                    <button onClick={() => setChildPage("home")} className="mt-3 text-[13px] text-blue-500 font-medium">홈으로 돌아가기</button>
                  </div>
                )}
              </div>
            )}

            {cTab === "알림" && (
              <div className="flex flex-col gap-3 pt-4">
                <p className="text-[17px] font-bold text-gray-900">알림</p>
                {childAlert ? (
                  <button onClick={() => { setCTab("홈"); setChildPage("alert-detail"); }} className="w-full bg-white border border-gray-100 rounded-2xl p-4 text-left active:scale-[0.98] hover:shadow-md transition-all">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0"><svg viewBox="0 0 24 24" fill="#ef4444" className="w-4 h-4"><path d="M12 2L2 21h20L12 2zm0 3.5L19.5 19h-15L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z" /></svg></div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between"><p className="text-[13px] font-bold text-gray-900">어머니 위험 거래 감지</p><p className="text-[11px] text-gray-400">{(childAlert as any).time || DEMO_ALERT.time}</p></div>
                        <p className="text-[12px] text-gray-500 mt-0.5">{((childAlert as any).amount || 3000000).toLocaleString()}원 · 선입금 모순 · HIGH</p>
                        {alertResponse && <p className="text-[11px] text-green-600 mt-1 font-medium">{alertResponse === "held" ? "보류 처리됨" : "승인 처리됨"}</p>}
                      </div>
                    </div>
                  </button>
                ) : <div className="text-center py-12"><p className="text-gray-400 text-[14px]">새로운 알림이 없어요</p></div>}
              </div>
            )}

            {cTab === "설정" && (
              <div className="flex flex-col gap-3 pt-4">
                <p className="text-[17px] font-bold text-gray-900">설정</p>
                <div className="bg-white rounded-2xl p-5">
                  <p className="text-[13px] font-bold text-gray-400 mb-4">내 정보</p>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-[18px] font-bold text-blue-600">지</div>
                    <div><p className="text-[16px] font-bold text-gray-900">김지혜</p><p className="text-[12px] text-gray-400">자녀 계정</p></div>
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-5">
                  <p className="text-[13px] font-bold text-gray-400 mb-4">안심동행 권한 레벨</p>
                  <div className="flex flex-col gap-3">
                    {[{lv:"Lv.0",name:"관심",desc:"위험 이벤트 알림만"},{lv:"Lv.1",name:"지연",desc:"고위험 24시간 쿨다운"},{lv:"Lv.2",name:"공동확인",desc:"기준 금액 이상 가족 확인 필요",active:true},{lv:"Lv.3",name:"피해 대응",desc:"사기 발생 시 긴급 모드"}].map((item) => (
                      <div key={item.lv} className={`flex items-center gap-3 p-3 rounded-xl ${item.active ? "bg-blue-50 border border-blue-200" : "bg-gray-50"}`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${item.active ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-500"}`}>{item.lv}</div>
                        <div><p className={`text-[13px] font-bold ${item.active ? "text-blue-700" : "text-gray-700"}`}>{item.name}{item.active && " (현재)"}</p><p className="text-[11px] text-gray-400 mt-0.5">{item.desc}</p></div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-400 text-center mt-3">권한은 부모님이 설정하고 언제든 회수 가능해요</p>
                </div>
              </div>
            )}
          </main>

          <nav className="sticky bottom-0 bg-white border-t border-gray-100 flex justify-around py-2 pt-3">
            {childTabs.map((t) => (
              <button key={t} onClick={() => { setCTab(t); if (t === "홈") setChildPage("home"); }} className={`flex flex-col items-center gap-1 text-[11px] py-1 px-4 relative ${cTab === t ? "text-blue-500 font-semibold" : "text-gray-400"}`}>
                {childIcons[t]}{t}
                {t === "알림" && childAlert && !alertResponse && <div className="absolute top-0.5 right-2 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center"><span className="text-[8px] font-bold text-white">1</span></div>}
              </button>
            ))}
          </nav>
        </>
      )}
    </div>
  );
}
