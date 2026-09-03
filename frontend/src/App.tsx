// 안심동행 AI — 라우팅만 담당.
// 화면별 상태는 각 screens/* 파일이 스스로 소유한다.
//
//   부모 앱: ParentHome ─┬─ Transfer  (송금 입력·확인 흐름)
//                        └─ Guardian  (안심동행 설정)
//   자녀 앱: ChildApp
//
// 부모↔자녀는 localStorage(ansimAlert·ansimPaired·ansimProtectionLevel 등 여러 키)로 연결된다.

import { useEffect, useState } from "react";
import { parentTabs, parentIcons } from "./shared/ui";
import { MY_ACCOUNTS, parseAmt, type Role, type TxnRow } from "./shared/data";
import Transfer from "./screens/Transfer";
import Guardian from "./screens/Guardian";
import ParentHome from "./screens/ParentHome";
import History from "./screens/History";
import MonthlySpending from "./screens/MonthlySpending";
import ChildApp from "./screens/ChildApp";
import Verify from "./screens/Verify";
import SavingsDetail from "./screens/SavingsDetail";
import CallBanner from "./screens/CallBanner";
import IncomingMessage from "./screens/IncomingMessage";
import NotificationShade from "./shared/NotificationShade";
import SearchOverlay, { type SearchItem } from "./shared/SearchOverlay";
import LimitIncrease from "./screens/LimitIncrease";
import CustomerCenter from "./screens/CustomerCenter";
import PrivacyPolicy from "./screens/PrivacyPolicy";
import LockScreen from "./screens/LockScreen";
import { DEMO_SCENARIOS } from "./shared/callscreen";
import { DEMO_MESSAGES } from "./shared/messages";
import { INITIAL_SIGNALS, type BehaviorSignals } from "./shared/behavior";
import { FinancialTab, ProductsTab, BenefitsTab, StocksTab } from "./screens/TabPages";
import { useGlobalCooldown } from "./shared/cooldown";
import CooldownPopup from "./shared/CooldownPopup";
import { markCallStarted } from "./shared/callActivity";

type ParentPage = "home" | "guardian" | "transfer" | "emergency" | "history" | "monthly-spending" | "verify" | "savings" | "limit" | "support" | "privacy";

const DEFAULT_DAILY_LIMIT = 5_000_000;

export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [role, setRole] = useState<Role>("parent");
  const [tab, setTab]   = useState<typeof parentTabs[number]>("홈");
  const [page, setPage] = useState<ParentPage>("home");
  const [accountIdx, setAccountIdx] = useState(0);   // 거래내역을 보는 계좌
  const [savingsIdx, setSavingsIdx] = useState(1);
  const [resumeIntentChatId, setResumeIntentChatId] = useState<string | null>(null);
  const [resumeIntentToHold, setResumeIntentToHold] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [largeText, setLargeText] = useState(() => localStorage.getItem("ansimLargeText") === "true");
  const [demoIdx, setDemoIdx] = useState(0);
  const [activeCall, setActiveCall] = useState<typeof DEMO_SCENARIOS[number] | null>(null);
  const [msgIdx, setMsgIdx] = useState(0);
  const [activeMessage, setActiveMessage] = useState<typeof DEMO_MESSAGES[number] | null>(null);
  const [paired, setPaired] = useState(() => localStorage.getItem("ansimPaired") === "true");
  const [behaviorSignals, setBehaviorSignals] = useState<BehaviorSignals>(INITIAL_SIGNALS);
  const [balanceOverrides, setBalanceOverrides] = useState<Record<number, string>>({});
  const [closedAccounts, setClosedAccounts] = useState<Set<number>>(new Set());
  const [transferFromIdx, setTransferFromIdx] = useState(0);
  const [extraTxns, setExtraTxns] = useState<Record<string, TxnRow[]>>({});
  const [showSearch, setShowSearch] = useState(false);
  const [dailyLimit, setDailyLimit] = useState(DEFAULT_DAILY_LIMIT);
  const [dailyTransferred, setDailyTransferred] = useState(0);
  const [openProductKey, setOpenProductKey] = useState<string | null>(null);
  const cooldownSecondsLeft = useGlobalCooldown();
  const [showCooldownPopup, setShowCooldownPopup] = useState(false);
  const [showAmountResetConfirm, setShowAmountResetConfirm] = useState(false);
  const [amountResetNotice, setAmountResetNotice] = useState(false);

  const liveAccounts = MY_ACCOUNTS.map((a, i) => ({
    ...a,
    balance: i in balanceOverrides ? balanceOverrides[i] : a.balance,
  }));

  // 송금 진입 공통 관문 — 어디서 "송금" 버튼을 눌렀든 전역 쿨다운이 남아있으면
  // 화면을 옮기지 않고 그 자리에서 팝업으로 막는다. 정지는 화면 하나가 아니라
  // 앱 전체에 걸려야 우회가 안 되기 때문이다.
  const goToTransfer = (fromIdx?: number) => {
    if (cooldownSecondsLeft > 0) { setShowCooldownPopup(true); return; }
    setResumeIntentChatId(null);
    if (fromIdx !== undefined) setTransferFromIdx(fromIdx);
    setPage("transfer");
  };

  // 심사 데모 중 변경된 금융 금액 상태만 초기값으로 되돌린다.
  // 상담 기록·가족 연결·보호 단계·쿨다운은 안전 기능 상태이므로 유지한다.
  const resetDemoAmounts = () => {
    setBalanceOverrides({});
    setClosedAccounts(new Set());
    setExtraTxns({});
    setDailyLimit(DEFAULT_DAILY_LIMIT);
    setDailyTransferred(0);
    setAccountIdx(0);
    setSavingsIdx(1);
    setTransferFromIdx(0);
    setResumeIntentChatId(null);
    setResumeIntentToHold(false);
    setOpenProductKey(null);
    setTab("홈");
    setPage("home");
    setShowAmountResetConfirm(false);
    setAmountResetNotice(true);
    window.setTimeout(() => setAmountResetNotice(false), 2_000);
  };

  const handleTransferSuccess = (fromIdx: number, amount: number, recipientName: string, toAccount: string) => {
    setDailyTransferred((previous) => previous + amount);
    const acc = liveAccounts[fromIdx];
    const current = parseAmt(acc.balance);
    const next = Math.max(0, current - amount);

    const now = new Date();
    const date = `${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
    const time = now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
    const outRow: TxnRow = { date, time, name: recipientName, memo: "이체", amount: -amount, balance: next };

    const cleanTo = toAccount.replace(/\D/g, "");
    const toIdx = liveAccounts.findIndex((m, i) => i !== fromIdx && cleanTo.length >= 8 && cleanTo.includes(m.account.slice(0, 8)));

    setBalanceOverrides((prev) => {
      const updated = { ...prev, [fromIdx]: next.toLocaleString("ko-KR") };
      if (toIdx !== -1) {
        const toCurrent = parseAmt(liveAccounts[toIdx].balance);
        updated[toIdx] = (toCurrent + amount).toLocaleString("ko-KR");
      }
      return updated;
    });

    setExtraTxns((prev) => {
      const updated = { ...prev, [acc.account]: [outRow, ...(prev[acc.account] ?? [])] };
      if (toIdx !== -1) {
        const toAcc = liveAccounts[toIdx];
        const toNext = parseAmt(toAcc.balance) + amount;
        const inRow: TxnRow = { date, time, name: `${acc.name}에서 이체`, memo: "이체", amount, balance: toNext };
        updated[toAcc.account] = [inRow, ...(prev[toAcc.account] ?? [])];
      }
      return updated;
    });
  };

  // 예금·적금 가입 — 입출금 계좌(0번)에서 신청 금액만큼 즉시 이체된다.
  const handleSubscribe = (amount: number, productTitle: string) => {
    const acc = liveAccounts[0];
    const current = parseAmt(acc.balance);
    const next = Math.max(0, current - amount);
    setBalanceOverrides((prev) => ({ ...prev, 0: next.toLocaleString("ko-KR") }));

    const now = new Date();
    const date = `${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
    const time = now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
    const row: TxnRow = { date, time, name: productTitle, memo: "가입", amount: -amount, balance: next };
    setExtraTxns((prev) => ({ ...prev, [acc.account]: [row, ...(prev[acc.account] ?? [])] }));
  };

  const toggleRole = () => setRole(role === "parent" ? "child" : "parent");

  useEffect(() => {
    const syncPairing = () => setPaired(localStorage.getItem("ansimPaired") === "true");
    const resetPrivateState = () => {
      setPaired(false);
      setLargeText(false);
    };
    window.addEventListener("ansim-paired", syncPairing);
    window.addEventListener("ansim-privacy-reset", resetPrivateState);
    window.addEventListener("storage", syncPairing);
    return () => {
      window.removeEventListener("ansim-paired", syncPairing);
      window.removeEventListener("ansim-privacy-reset", resetPrivateState);
      window.removeEventListener("storage", syncPairing);
    };
  }, []);

  const toggleLargeText = () => {
    setLargeText((current) => {
      const next = !current;
      localStorage.setItem("ansimLargeText", String(next));
      return next;
    });
  };

  const triggerDemoCall = () => {
    if (activeCall) return;
    markCallStarted(); // 10분 내 통화 기록 판단용 — 카운트를 이 시각부터 다시 센다
    setActiveCall(DEMO_SCENARIOS[demoIdx % DEMO_SCENARIOS.length]);
    setDemoIdx((i) => (i + 1) % DEMO_SCENARIOS.length);
  };

  const triggerDemoMessage = () => {
    if (activeMessage) return;
    setActiveMessage(DEMO_MESSAGES[msgIdx % DEMO_MESSAGES.length]);
    setMsgIdx((i) => (i + 1) % DEMO_MESSAGES.length);
  };

  const scenarioLabel = DEMO_SCENARIOS[demoIdx % DEMO_SCENARIOS.length].label;
  const messageLabel  = DEMO_MESSAGES[msgIdx % DEMO_MESSAGES.length].sender;

  const goHome = (targetTab: typeof parentTabs[number] = "홈") => { setTab(targetTab); setPage("home"); };

  const searchItems: SearchItem[] = [
    { label: "거래내역", desc: "한결은행 입출금통장 거래내역", keywords: ["내역", "이체", "입금", "출금"], onSelect: () => { setAccountIdx(0); setPage("history"); } },
    { label: "9월 이용 내역", desc: "이번 달 이체·자동이체·체크카드 내역", keywords: ["9월", "이용", "지출", "월별"], onSelect: () => setPage("monthly-spending") },
    { label: "송금", desc: "계좌이체 보내기", keywords: ["이체", "보내기"], onSelect: () => goToTransfer(0) },
    { label: "이체한도 상향", desc: "1일 이체한도 관리", keywords: ["한도", "상향", "이체한도"], onSelect: () => setPage("limit") },
    { label: "상대방 검증", desc: "번호·링크·기관명 안전 여부 확인", keywords: ["검증", "사기", "확인"], onSelect: () => setPage("verify") },
    { label: "안심 정기예금", desc: "연 3.5% · 12개월 · 가입 신청", keywords: ["예금", "신청", "가입"], onSelect: () => { goHome(); setOpenProductKey("안심 정기예금"); } },
    { label: "내일채움 적금", desc: "월 30만원부터 · 가입 신청", keywords: ["적금", "신청", "가입"], onSelect: () => { goHome(); setOpenProductKey("내일채움 적금"); } },
    { label: "안심 신용대출", desc: "최저 연 4.2% · 신청", keywords: ["대출", "신청"], onSelect: () => { goHome(); setOpenProductKey("안심 신용대출"); } },
    { label: "주택청약종합저축", desc: "비과세 · 소득공제 · 가입 신청", keywords: ["청약", "신청", "가입"], onSelect: () => { goHome(); setOpenProductKey("주택청약종합저축"); } },
    { label: "정기적금 조회", desc: "토스뱅크 정기적금", keywords: ["적금"], onSelect: () => { setSavingsIdx(1); setPage("savings"); } },
    { label: "정기예금 조회", desc: "쏠편한 정기예금", keywords: ["예금"], onSelect: () => { setSavingsIdx(2); setPage("savings"); } },
    { label: "주식", desc: "관심 종목·포트폴리오", keywords: ["주식", "투자", "종목"], onSelect: () => goHome("주식") },
    { label: "안심동행 설정", desc: "가족 연동·권한 관리", keywords: ["가족", "설정", "권한"], onSelect: () => setPage("guardian") },
  ];

  if (!unlocked) {
    return <LockScreen onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <>
      {/* ── 은행 앱 컨테이너 ── */}
      <div className={`relative mx-auto min-h-dvh max-w-[430px] flex flex-col ${role === "parent" ? `theme-parent bg-[#fafbfe] ${largeText ? "senior-mode" : ""}` : "theme-child bg-white"}`}>

        {/*
          두 앱을 항상 마운트해 두고 보이기만 전환한다.
          역할을 오가도 송금 진행 상황·입력값·대화가 그대로 남아야 MVP 시연이 끊기지 않는다.
        */}
        <div className={role === "parent" ? "contents" : "hidden"}>
          <header className="sticky top-0 z-20 bg-[#fafbfe] flex items-center justify-between px-5 py-4">
            <button onClick={() => { setTab("홈"); setPage("home"); }} className="flex items-center gap-1.5 active:scale-95 transition-transform">
              <svg viewBox="0 0 24 24" fill="#2563eb" className="w-5 h-5"><path d="M12 2L2 7.5v1h20v-1L12 2z" /><path d="M4.5 9h2v8h-2zM9 9h2v8H9zM13 9h2v8h-2zM17.5 9h2v8h-2z" /><path d="M2 17h20v2H2z" /><circle cx="12" cy="5.2" r="0.8" fill="white" /></svg>
              <span className="text-[17px] font-bold text-gray-900 tracking-tight">한결은행</span>
            </button>
            <div className="flex gap-1 items-center">
              {!largeText && (
                <button onClick={() => setShowSearch(true)} aria-label="검색" className="group rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 active:scale-90 transition-all duration-200">
                  {/* group-hover:scale-110은 뺐다 — 모바일 터치는 tap 후에도 :hover가 안 풀려서
                      버튼을 누를 때마다 아이콘이 살짝 확대된 채로 남는 버그였다(PC 마우스 호버는
                      원래도 active:scale-90 하나로 충분히 눌리는 느낌이 난다). */}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></svg>
                </button>
              )}
              <button onClick={() => setShowNotifications(true)} aria-label="알림" className="group rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 active:scale-90 transition-all duration-200">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 origin-top group-hover:[animation:bell-swing_.6s_ease-in-out]"><path d="M12 2a1.5 1.5 0 011.5 1.5v.3A6 6 0 0118 9.5c0 3.5 1 5.5 2 7 .3.4 0 1-.5 1H4.5c-.5 0-.8-.6-.5-1 1-1.5 2-3.5 2-7a6 6 0 014.5-5.7v-.3A1.5 1.5 0 0112 2z" /><path d="M9.5 17.5a2.5 2.5 0 005 0" /></svg>
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={largeText}
                aria-label={largeText ? "일반 홈으로 전환" : "쉬운 홈으로 전환"}
                onClick={toggleLargeText}
                className="ml-1 flex items-center rounded-full border border-blue-100 bg-white p-0.5 text-[12px] font-bold shadow-sm hover:shadow-md hover:border-blue-300 hover:-translate-y-0.5 active:scale-95 transition-all duration-200"
              >
                <span className={`rounded-full px-2.5 py-1 transition-colors ${largeText ? "bg-blue-600 text-white" : "text-blue-600"}`}>쉬운</span>
                <span className={`rounded-full px-2.5 py-1 transition-colors ${largeText ? "text-gray-500" : "bg-blue-600 text-white"}`}>홈</span>
              </button>
            </div>
          </header>

          <main className="flex-1 px-3 pb-4">
            {(page === "transfer" || page === "emergency") && (
              <Transfer
                onExit={() => setPage("home")}
                initialStep={page === "emergency" ? "already-sent" : "input"}
                resumeSessionId={resumeIntentChatId}
                resumeToHold={resumeIntentToHold}
                onResumeHandled={() => { setResumeIntentChatId(null); setResumeIntentToHold(false); }}
                behaviorSignals={behaviorSignals}
                accounts={liveAccounts}
                onSuccess={handleTransferSuccess}
                defaultFromIdx={transferFromIdx}
                dailyLimit={dailyLimit}
                dailyTransferred={dailyTransferred}
              />
            )}
            {page === "guardian" && (
              <Guardian
                appRole="parent"
                onExit={() => setPage("home")}
                onResumeIntentChat={(id) => {
                  setResumeIntentToHold(false);
                  setResumeIntentChatId(id);
                  setPage("transfer");
                }}
                onOpenPendingConfirmation={(id) => {
                  setResumeIntentToHold(true);
                  setResumeIntentChatId(id);
                  setPage("transfer");
                }}
                onEmergency={() => {
                  setResumeIntentChatId(null);
                  setPage("emergency");
                }}
              />
            )}
            {page === "verify"   && <Verify onBack={() => { setPage("home"); setBehaviorSignals((s) => ({ ...s, verifyVisited: true })); }} />}
            {page === "support"  && <CustomerCenter onBack={() => setPage("home")} bankName="한결은행" />}
            {page === "privacy"  && <PrivacyPolicy onBack={() => setPage("home")} />}
            {page === "limit"    && (
              <LimitIncrease
                currentLimit={dailyLimit}
                onBack={() => setPage("home")}
                onIncreased={(limit) => {
                  setDailyLimit(limit);
                  setBehaviorSignals((s) => ({ ...s, limitIncreased: s.limitIncreased + 1 }));
                }}
                isOnCall={behaviorSignals.isOnCall}
              />
            )}
            {page === "savings"  && (
              <SavingsDetail
                account={liveAccounts[savingsIdx]}
                onBack={() => setPage("home")}
                onTransfer={() => goToTransfer(savingsIdx)}
                isClosed={closedAccounts.has(savingsIdx)}
                isOnCall={behaviorSignals.isOnCall}
                onEarlyClosure={(amount) => {
                  setBehaviorSignals((s) => ({ ...s, savingsEarlyClose: s.savingsEarlyClose + 1 }));
                  setClosedAccounts((prev) => new Set(prev).add(savingsIdx));
                  const mainCurrent = parseAmt(liveAccounts[0].balance);
                  const mainNext = mainCurrent + amount;
                  setBalanceOverrides((prev) => ({
                    ...prev,
                    [savingsIdx]: "0",
                    [0]: mainNext.toLocaleString("ko-KR"),
                  }));

                  const now = new Date();
                  const date = `${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
                  const time = now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
                  const row: TxnRow = { date, time, name: `${liveAccounts[savingsIdx].name} 해지`, memo: "해지입금", amount, balance: mainNext };
                  setExtraTxns((prev) => ({ ...prev, [liveAccounts[0].account]: [row, ...(prev[liveAccounts[0].account] ?? [])] }));
                }}
              />
            )}
            {page === "history" && (
              <History
                account={liveAccounts[accountIdx]}
                onBack={() => setPage("home")}
                onTransfer={() => goToTransfer()}
                onGuardian={() => setPage("guardian")}
                extraRows={extraTxns[liveAccounts[accountIdx].account] ?? []}
              />
            )}
            {page === "monthly-spending" && (
              <MonthlySpending
                onBack={() => setPage("home")}
                onGuardian={() => setPage("guardian")}
                onTransfer={() => {
                  setResumeIntentChatId(null);
                  setTransferFromIdx(0);
                  setPage("transfer");
                }}
              />
            )}
            {page === "home" && tab === "홈" && (
              <ParentHome
                onTransfer={(i) => goToTransfer(i)}
                largeText={largeText}
                onGuardian={() => setPage("guardian")}
                onAccount={(i) => {
                  setBehaviorSignals((s) => ({ ...s, historyVisits: s.historyVisits + 1 }));
                  const name = MY_ACCOUNTS[i].name;
                  if (name.includes("적금") || name.includes("예금")) {
                    setSavingsIdx(i); setPage("savings");
                  } else {
                    setAccountIdx(i); setPage("history");
                  }
                }}
                onVerify={() => setPage("verify")}
                onSupport={() => setPage("support")}
                onPrivacy={() => setPage("privacy")}
                onLimitIncrease={() => setPage("limit")}
                onAllAccounts={() => setTab("금융")}
                onMonthlyDetail={() => setPage("monthly-spending")}
                accounts={liveAccounts}
                onSubscribe={handleSubscribe}
                openProductKey={openProductKey}
                onProductOpened={() => setOpenProductKey(null)}
              />
            )}
            {page === "home" && tab === "금융" && (
              <FinancialTab
                accounts={liveAccounts}
                onAccount={(i) => {
                  setBehaviorSignals((s) => ({ ...s, historyVisits: s.historyVisits + 1 }));
                  const name = MY_ACCOUNTS[i].name;
                  if (name.includes("적금") || name.includes("예금")) {
                    setSavingsIdx(i); setPage("savings");
                  } else {
                    setAccountIdx(i); setPage("history");
                  }
                }}
              />
            )}
            {page === "home" && tab === "상품" && (
              <ProductsTab onSavings={(i) => { setSavingsIdx(i); setPage("savings"); }} />
            )}
            {page === "home" && tab === "혜택" && <BenefitsTab />}
            {page === "home" && tab === "주식" && <StocksTab role="parent" />}
          </main>

          <nav className="parent-bottom-nav sticky bottom-0 bg-white rounded-t-[28px] flex justify-around py-2 pt-3 pb-3 mt-4">
            {parentTabs.map((t) => (
              <button key={t} onClick={() => { setTab(t); if (page !== "home") setPage("home"); }}
                className={`flex flex-col items-center gap-1 text-[11px] py-1 px-3 ${tab === t && page === "home" ? "text-gray-900 font-semibold" : "text-gray-400"}`}>
                {parentIcons[t]}{t}
              </button>
            ))}
          </nav>
        </div>

        <div className={role === "child" ? "contents" : "hidden"}>
          <ChildApp />
        </div>

        {role === "parent" && showSearch && (
          <SearchOverlay items={searchItems} onClose={() => setShowSearch(false)} />
        )}

        {role === "parent" && showNotifications && (
          <NotificationShade
            role="parent"
            onClose={() => setShowNotifications(false)}
            extraTxns={extraTxns[liveAccounts[0].account] ?? []}
          />
        )}

        {showCooldownPopup && cooldownSecondsLeft > 0 && (
          <CooldownPopup secondsLeft={cooldownSecondsLeft} onClose={() => setShowCooldownPopup(false)} />
        )}

        {/* 수신 전화 → 통화 중 → 종료까지 하나로 이어지는 배너 / 수신 문자 배너 */}
        {activeCall && (
          <CallBanner
            call={activeCall}
            onEnd={() => { setActiveCall(null); setBehaviorSignals((s) => ({ ...s, isOnCall: false })); }}
            onPhaseChange={(phase) => setBehaviorSignals((s) => ({ ...s, isOnCall: phase === "active" }))}
          />
        )}
        {activeMessage && <IncomingMessage message={activeMessage} onDismiss={() => setActiveMessage(null)} />}
      </div>

      {/* ── 앱 외부 데모 조작 ── */}
      <div className="fixed left-[calc(50%+235px)] top-5 z-[90] flex items-center gap-2 max-[760px]:left-auto max-[760px]:right-3 max-[760px]:top-auto max-[760px]:bottom-24">
        <button
          type="button"
          onClick={toggleRole}
          className="group flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-3 text-[13px] font-bold text-gray-700 shadow-lg hover:-translate-y-0.5 hover:border-blue-300 hover:text-blue-600 hover:shadow-xl active:scale-95 transition-all duration-200"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 transition-transform duration-300 group-hover:rotate-180"><path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" /></svg>
          {role === "parent" ? "자녀 앱으로 전환" : "부모 앱으로 전환"}
        </button>
        <button
          type="button"
          onClick={() => setShowAmountResetConfirm(true)}
          className="group flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-3 text-[13px] font-bold text-gray-700 shadow-lg hover:-translate-y-0.5 hover:border-blue-300 hover:text-blue-600 hover:shadow-xl active:scale-95 transition-all duration-200"
          aria-label="데모 금액 상태 초기화"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 transition-transform duration-500 group-hover:-rotate-180" aria-hidden="true">
            <path d="M20 11a8 8 0 10-2.34 5.66" />
            <path d="M20 4v7h-7" />
          </svg>
          금액 초기화
        </button>
      </div>

      {showAmountResetConfirm && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 px-5 backdrop-blur-[2px]"
          onClick={() => setShowAmountResetConfirm(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="amount-reset-title"
            className="w-full max-w-[360px] rounded-[24px] bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
                <path d="M20 11a8 8 0 10-2.34 5.66" />
                <path d="M20 4v7h-7" />
              </svg>
            </div>
            <h2 id="amount-reset-title" className="mt-4 text-[18px] font-extrabold text-gray-900">금액 초기화</h2>
            <p className="mt-2 text-[15px] font-semibold leading-relaxed text-gray-700">금액 상태를 처음으로 되돌릴까요?</p>
            <p className="mt-1 text-[13px] leading-relaxed text-gray-500">AI 상담 기록과 가족 연결은 유지돼요.</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowAmountResetConfirm(false)}
                className="h-12 rounded-xl bg-gray-100 text-[14px] font-bold text-gray-600 active:scale-[0.98] transition-transform"
              >
                취소
              </button>
              <button
                type="button"
                onClick={resetDemoAmounts}
                className="h-12 rounded-xl bg-blue-600 text-[14px] font-bold text-white active:scale-[0.98] transition-transform"
              >
                초기화하기
              </button>
            </div>
          </div>
        </div>
      )}

      {amountResetNotice && (
        <div role="status" className="fixed left-1/2 top-6 z-[130] -translate-x-1/2 rounded-full bg-gray-900 px-4 py-2.5 text-[13px] font-bold text-white shadow-xl">
          금액이 처음 상태로 돌아갔어요
        </div>
      )}

      {/* ── 앱 외부 시뮬레이션 버튼 (안심동행 연결 후 기능 1번 데모로만 노출) ── */}
      {paired && (
        <div
          className="fixed z-50 flex flex-col items-center gap-3.5 left-[calc(50%+235px)] top-[84px] max-[760px]:left-auto max-[760px]:right-3 max-[760px]:top-auto max-[760px]:bottom-44"
        >
          {/* 전화 수신 버튼 */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative flex items-center justify-center">
              <button
                onClick={triggerDemoCall}
                disabled={!!activeCall}
                className={`relative flex h-12 w-12 items-center justify-center rounded-[14px] shadow-lg transition-all active:scale-90 ${
                  activeCall ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-b from-[#5ff474] to-[#09b72f] hover:scale-105'
                }`}
                style={{ boxShadow: activeCall ? 'none' : '0 4px 16px rgba(9,183,47,0.42), inset 0 1px 0 rgba(255,255,255,0.35)' }}
              >
                <svg viewBox="0 0 24 24" fill="white" className="h-7 w-7">
                  <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
                </svg>
              </button>
            </div>
            {/* 폭을 고정해서 항상 렌더링한다 — 라벨을 아예 안 그리면(조건부 렌더) 폭 기준이
                되는 요소가 사라져서, 통화 시작 같은 액션에 버튼 전체가 왼쪽으로 쏠려 보였다.
                긴 시나리오 문구(예: "해외(필리핀) 발신 의심전화")가 떠 있을 때 특히 심했다. */}
            <div
              className={`bg-gray-900/80 backdrop-blur-sm rounded-lg px-2 py-1 text-center ${activeCall ? 'invisible' : ''}`}
              style={{ width: 84 }}
            >
              <p className="text-white/40 text-[8px] font-medium uppercase tracking-widest">전화</p>
              <p className="text-white text-[10px] font-semibold leading-tight">{scenarioLabel}</p>
            </div>
          </div>

          {/* 문자 수신 버튼 */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative flex items-center justify-center">
              <button
                onClick={triggerDemoMessage}
                disabled={!!activeMessage}
                className={`relative flex h-12 w-12 items-center justify-center rounded-[14px] shadow-lg transition-all active:scale-90 ${
                  activeMessage ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-b from-[#5ff474] to-[#09b72f] hover:scale-105'
                }`}
                style={{ boxShadow: activeMessage ? 'none' : '0 4px 16px rgba(9,183,47,0.42), inset 0 1px 0 rgba(255,255,255,0.35)' }}
              >
                <svg viewBox="0 0 24 24" fill="white" className="h-8 w-8">
                  <path d="M12 4C6.9 4 3 7.2 3 11.3c0 2.2 1.1 4.1 3 5.5l-.7 3.2 3.5-1.8c1 .3 2.1.5 3.2.5 5.1 0 9-3.2 9-7.4S17.1 4 12 4z" />
                </svg>
              </button>
            </div>
            <div
              className={`bg-gray-900/80 backdrop-blur-sm rounded-lg px-2 py-1 text-center ${activeMessage ? 'invisible' : ''}`}
              style={{ width: 84 }}
            >
              <p className="text-white/40 text-[8px] font-medium uppercase tracking-widest">문자</p>
              <p className="text-white text-[10px] font-semibold leading-tight">{messageLabel}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
