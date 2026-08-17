// 안심동행 AI — 라우팅만 담당.
// 화면별 상태는 각 screens/* 파일이 스스로 소유한다.
//
//   부모 앱: ParentHome ─┬─ Transfer  (송금 7단계)
//                        └─ Guardian  (안심동행 설정)
//   자녀 앱: ChildApp
//
// 부모↔자녀는 localStorage("ansimAlert") 로만 연결된다.

import { useState } from "react";
import { parentTabs, parentIcons, RoleToggle } from "./shared/ui";
import { MY_ACCOUNTS, parseAmt, type Role, type TxnRow } from "./shared/data";
import Transfer from "./screens/Transfer";
import Guardian from "./screens/Guardian";
import ParentHome from "./screens/ParentHome";
import History from "./screens/History";
import ChildApp from "./screens/ChildApp";
import Verify from "./screens/Verify";
import SavingsDetail from "./screens/SavingsDetail";
import IncomingCall from "./screens/IncomingCall";
import IncomingMessage from "./screens/IncomingMessage";
import NotificationShade from "./shared/NotificationShade";
import { DEMO_SCENARIOS } from "./shared/callscreen";
import { DEMO_MESSAGES } from "./shared/messages";
import { INITIAL_SIGNALS, type BehaviorSignals } from "./shared/behavior";
import { FinancialTab, ProductsTab, BenefitsTab, StocksTab } from "./screens/TabPages";

type ParentPage = "home" | "guardian" | "transfer" | "history" | "verify" | "savings";

export default function App() {
  const [role, setRole] = useState<Role>("parent");
  const [tab, setTab]   = useState<typeof parentTabs[number]>("홈");
  const [page, setPage] = useState<ParentPage>("home");
  const [accountIdx, setAccountIdx] = useState(0);
  const [savingsIdx, setSavingsIdx] = useState(1);
  const [showNotifications, setShowNotifications] = useState(false);
  const [demoIdx, setDemoIdx] = useState(0);
  const [activeCall, setActiveCall] = useState<typeof DEMO_SCENARIOS[number] | null>(null);
  const [msgIdx, setMsgIdx] = useState(0);
  const [activeMessage, setActiveMessage] = useState<typeof DEMO_MESSAGES[number] | null>(null);
  const [behaviorSignals, setBehaviorSignals] = useState<BehaviorSignals>(INITIAL_SIGNALS);
  const [balanceOverrides, setBalanceOverrides] = useState<Record<number, string>>({});
  const [closedAccounts, setClosedAccounts] = useState<Set<number>>(new Set());
  const [transferFromIdx, setTransferFromIdx] = useState(0);
  const [extraTxns, setExtraTxns] = useState<Record<string, TxnRow[]>>({});

  const liveAccounts = MY_ACCOUNTS.map((a, i) => ({
    ...a,
    balance: i in balanceOverrides ? balanceOverrides[i] : a.balance,
  }));

  const handleTransferSuccess = (fromIdx: number, amount: number, recipientName: string, toAccount: string) => {
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

  const toggleRole = () => setRole(role === "parent" ? "child" : "parent");

  const triggerDemoCall = () => {
    if (activeCall) return;
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

  return (
    <>
      {/* ── 은행 앱 컨테이너 ── */}
      <div className={`relative mx-auto min-h-dvh max-w-[430px] flex flex-col ${role === "parent" ? "theme-parent bg-[#fafbfe]" : "theme-child bg-white"}`}>

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
            <div className="flex gap-2 items-center">
              <button className="text-gray-400"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></svg></button>
              <button onClick={() => setShowNotifications(true)} className="text-gray-400 active:scale-90 transition-transform"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M12 2a1.5 1.5 0 011.5 1.5v.3A6 6 0 0118 9.5c0 3.5 1 5.5 2 7 .3.4 0 1-.5 1H4.5c-.5 0-.8-.6-.5-1 1-1.5 2-3.5 2-7a6 6 0 014.5-5.7v-.3A1.5 1.5 0 0112 2z" /><path d="M9.5 17.5a2.5 2.5 0 005 0" /></svg></button>
              <RoleToggle role="parent" onToggle={toggleRole} />
            </div>
          </header>

          <main className="flex-1 px-3 pb-4">
            {page === "transfer" && <Transfer onExit={() => setPage("home")} behaviorSignals={behaviorSignals} accounts={liveAccounts} onSuccess={handleTransferSuccess} defaultFromIdx={transferFromIdx} />}
            {page === "guardian" && <Guardian appRole="parent" onExit={() => setPage("home")} />}
            {page === "verify"   && <Verify onBack={() => { setPage("home"); setBehaviorSignals((s) => ({ ...s, verifyVisited: true })); }} />}
            {page === "savings"  && (
              <SavingsDetail
                account={liveAccounts[savingsIdx]}
                onBack={() => setPage("home")}
                onTransfer={() => { setTransferFromIdx(savingsIdx); setPage("transfer"); }}
                isClosed={closedAccounts.has(savingsIdx)}
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
                onTransfer={() => setPage("transfer")}
                onGuardian={() => setPage("guardian")}
                extraRows={extraTxns[liveAccounts[accountIdx].account] ?? []}
              />
            )}
            {page === "home" && tab === "홈" && (
              <ParentHome
                onTransfer={(i) => { setTransferFromIdx(i); setPage("transfer"); }}
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
                onAllAccounts={() => setTab("금융")}
                onMonthlyDetail={() => setTab("금융")}
                accounts={liveAccounts}
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
            {page === "home" && tab === "주식" && <StocksTab />}
          </main>

          <nav className="sticky bottom-0 bg-white rounded-[28px] flex justify-around py-2 pt-3 mt-4">
            {parentTabs.map((t) => (
              <button key={t} onClick={() => { setTab(t); if (page !== "home") setPage("home"); }}
                className={`flex flex-col items-center gap-1 text-[11px] py-1 px-3 ${tab === t && page === "home" ? "text-gray-900 font-semibold" : "text-gray-400"}`}>
                {parentIcons[t]}{t}
              </button>
            ))}
          </nav>
        </div>

        <div className={role === "child" ? "contents" : "hidden"}>
          <ChildApp onSwitchRole={toggleRole} />
        </div>

        {role === "parent" && showNotifications && <NotificationShade role="parent" onClose={() => setShowNotifications(false)} />}

        {/* 수신 전화 / 수신 문자 배너 */}
        {activeCall    && <IncomingCall    call={activeCall}       onDismiss={() => setActiveCall(null)} />}
        {activeMessage && <IncomingMessage message={activeMessage} onDismiss={() => setActiveMessage(null)} />}
      </div>

      {/* ── 앱 외부 시뮬레이션 버튼 (데스크톱 뷰 기준 앱 오른쪽) ── */}
      <div
        className="fixed z-50 flex flex-col items-center gap-5"
        style={{ left: 'calc(50% + 232px)', top: '50%', transform: 'translateY(-50%)' }}
      >
        {/* 전화 수신 버튼 */}
        <div className="flex flex-col items-center gap-2">
          <div className="relative flex items-center justify-center">
            {!activeCall && (
              <>
                <div className="absolute w-20 h-20 rounded-full bg-green-500/20 animate-ping" style={{ animationDuration: '1.4s' }} />
                <div className="absolute w-16 h-16 rounded-full bg-green-500/15 animate-ping" style={{ animationDuration: '1.4s', animationDelay: '0.2s' }} />
              </>
            )}
            <button
              onClick={triggerDemoCall}
              disabled={!!activeCall}
              className={`relative w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all active:scale-90 ${
                activeCall ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600 hover:scale-105'
              }`}
              style={{ boxShadow: activeCall ? 'none' : '0 4px 24px rgba(34,197,94,0.5)' }}
            >
              <svg viewBox="0 0 24 24" fill="white" style={{ width: 26, height: 26 }}>
                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
              </svg>
            </button>
          </div>
          {!activeCall && (
            <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl px-3 py-1.5 text-center" style={{ minWidth: 88 }}>
              <p className="text-white/40 text-[9px] font-medium uppercase tracking-widest">전화</p>
              <p className="text-white text-[11px] font-semibold mt-0.5 leading-tight">{scenarioLabel}</p>
            </div>
          )}
        </div>

        {/* 문자 수신 버튼 */}
        <div className="flex flex-col items-center gap-2">
          <div className="relative flex items-center justify-center">
            {!activeMessage && (
              <>
                <div className="absolute w-20 h-20 rounded-full bg-blue-500/20 animate-ping" style={{ animationDuration: '1.8s' }} />
                <div className="absolute w-16 h-16 rounded-full bg-blue-500/15 animate-ping" style={{ animationDuration: '1.8s', animationDelay: '0.3s' }} />
              </>
            )}
            <button
              onClick={triggerDemoMessage}
              disabled={!!activeMessage}
              className={`relative w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all active:scale-90 ${
                activeMessage ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600 hover:scale-105'
              }`}
              style={{ boxShadow: activeMessage ? 'none' : '0 4px 24px rgba(59,130,246,0.5)' }}
            >
              <svg viewBox="0 0 24 24" fill="white" style={{ width: 26, height: 26 }}>
                <path d="M20 2H4a2 2 0 00-2 2v16l4-4h14a2 2 0 002-2V4a2 2 0 00-2-2z" />
              </svg>
            </button>
          </div>
          {!activeMessage && (
            <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl px-3 py-1.5 text-center" style={{ minWidth: 88 }}>
              <p className="text-white/40 text-[9px] font-medium uppercase tracking-widest">문자</p>
              <p className="text-white text-[11px] font-semibold mt-0.5 leading-tight">{messageLabel}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
