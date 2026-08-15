// 안심동행 AI — 라우팅만 담당.
// 화면별 상태는 각 screens/* 파일이 스스로 소유한다.
//
//   부모 앱: ParentHome ─┬─ Transfer  (송금 7단계)
//                        └─ Guardian  (안심동행 설정)
//   자녀 앱: ChildApp
//
// 부모↔자녀는 localStorage("ansimAlert") 로만 연결된다.

import { useState } from "react";
import { parentTabs, parentIcons } from "./shared/ui";
import { MY_ACCOUNTS, type Role } from "./shared/data";
import Transfer from "./screens/Transfer";
import Guardian from "./screens/Guardian";
import ParentHome from "./screens/ParentHome";
import History from "./screens/History";
import ChildApp from "./screens/ChildApp";
import NotificationShade from "./shared/NotificationShade";

type ParentPage = "home" | "guardian" | "transfer" | "history";

export default function App() {
  const [role, setRole] = useState<Role>("parent");
  const [tab, setTab]   = useState<typeof parentTabs[number]>("홈");
  const [page, setPage] = useState<ParentPage>("home");
  const [accountIdx, setAccountIdx] = useState(0);   // 거래내역을 보는 계좌
  const [showNotifications, setShowNotifications] = useState(false);
  const [largeText, setLargeText] = useState(() => localStorage.getItem("ansimLargeText") === "true");

  const toggleRole = () => setRole(role === "parent" ? "child" : "parent");
  const toggleLargeText = () => {
    setLargeText((current) => {
      const next = !current;
      localStorage.setItem("ansimLargeText", String(next));
      return next;
    });
  };

  // 배경: 부모(한결은행)는 푸른빛, 자녀(나눔은행)는 올리브빛 — 다른 은행임을 배경으로도 구분
  return (
    <div className="relative min-h-dvh">
    <div className={`mx-auto min-h-dvh max-w-[430px] flex flex-col ${role === "parent" ? `theme-parent bg-[#fafbfe] ${largeText ? "senior-mode" : ""}` : "theme-child bg-white"}`}>

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
              {!largeText && <button className="text-gray-400"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></svg></button>}
              <button onClick={() => setShowNotifications(true)} className="text-gray-400 active:scale-90 transition-transform"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M12 2a1.5 1.5 0 011.5 1.5v.3A6 6 0 0118 9.5c0 3.5 1 5.5 2 7 .3.4 0 1-.5 1H4.5c-.5 0-.8-.6-.5-1 1-1.5 2-3.5 2-7a6 6 0 014.5-5.7v-.3A1.5 1.5 0 0112 2z" /><path d="M9.5 17.5a2.5 2.5 0 005 0" /></svg></button>
              <button
                type="button"
                role="switch"
                aria-checked={largeText}
                aria-label={largeText ? "일반 홈으로 전환" : "쉬운 홈으로 전환"}
                onClick={toggleLargeText}
                className="flex items-center rounded-full border border-blue-100 bg-white p-0.5 text-[12px] font-bold shadow-sm active:scale-95 transition-transform"
              >
                <span className={`rounded-full px-2.5 py-1 transition-colors ${largeText ? "bg-blue-600 text-white" : "text-blue-600"}`}>쉬운</span>
                <span className={`rounded-full px-2.5 py-1 transition-colors ${largeText ? "text-gray-500" : "bg-blue-600 text-white"}`}>홈</span>
              </button>
            </div>
          </header>

          <main className="flex-1 px-3 pb-4">
            {page === "transfer" && <Transfer onExit={() => setPage("home")} />}
            {page === "guardian" && <Guardian appRole="parent" onExit={() => setPage("home")} />}
            {page === "history" && (
              <History
                account={MY_ACCOUNTS[accountIdx]}
                onBack={() => setPage("home")}
                onTransfer={() => setPage("transfer")}
                onGuardian={() => setPage("guardian")}
              />
            )}
            {page === "home" && tab === "홈" && (
              <ParentHome
                onTransfer={() => setPage("transfer")}
                onGuardian={() => setPage("guardian")}
                onAccount={(i) => { setAccountIdx(i); setPage("history"); }}
                largeText={largeText}
              />
            )}
          </main>

          <nav className="parent-bottom-nav sticky bottom-0 bg-white rounded-[28px] flex justify-around py-2 pt-3 mt-4">
            {parentTabs.map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex flex-col items-center gap-1 text-[11px] py-1 px-3 ${tab === t ? "text-gray-900 font-semibold" : "text-gray-400"}`}>
                {parentIcons[t]}{t}
              </button>
            ))}
          </nav>
      </div>

      <div className={role === "child" ? "contents" : "hidden"}>
        <ChildApp />
      </div>
      {role === "parent" && showNotifications && <NotificationShade role="parent" onClose={() => setShowNotifications(false)} />}
    </div>
    <button
      type="button"
      onClick={toggleRole}
      className="fixed left-[calc(50%+235px)] top-5 z-[90] rounded-xl border border-gray-200 bg-white px-4 py-3 text-[13px] font-bold text-gray-700 shadow-lg active:scale-95 transition-all max-[760px]:left-auto max-[760px]:right-3 max-[760px]:top-auto max-[760px]:bottom-24"
    >
      {role === "parent" ? "자녀 앱으로 전환" : "부모 앱으로 전환"}
    </button>
    </div>
  );
}
