// 자녀 앱 — 홈 / 알림 / 설정
//
// 부모 앱과는 localStorage("ansimAlert") 로만 연결된다.
// 실서비스에서는 Supabase Realtime 등 푸시 채널이 들어갈 자리.
//
// 프라이버시 원칙: 자녀는 어떤 레벨에서도 잔액·거래내역을 볼 수 없다.
// 위험 이벤트의 최소 정보(금액·수취계좌·판정 근거)만 전달된다.

import { useState, useEffect } from "react";
import { parentTabs, parentIcons } from "../shared/ui";
import { DEMO_ALERT, CHILD_ACCOUNT, fmtAccount, parseAmt, type DemoAlert, type TxnRow } from "../shared/data";
import History from "./History";
import Transfer from "./Transfer";
import Guardian from "./Guardian";
import NotificationShade from "../shared/NotificationShade";
import { FinancialTab, ProductsTab, BenefitsTab, StocksTab } from "./TabPages";
import { PROTECTION_LEVELS, useProtectionLevel } from "../shared/protection";
import {
  markGuardianLogViewed, openGuardianLogEntry, recordGuardianDecision,
} from "../shared/guardianLog";

type Tab = typeof parentTabs[number];
type AlertResponse = "approved" | "held" | null;

const EMERGENCY_LIMIT = 500_000;

type LifeBenefit = { title: string; cond: string; amount: string; link: string };
const LIFE_BENEFITS: LifeBenefit[] = [
  { title: "청년 월세 지원",     cond: "만 19~34세 무주택 청년",       amount: "월 20만원 · 최대 12개월", link: "복지로(bokjiro.go.kr)" },
  { title: "청년내일저축계좌",   cond: "근로 중인 차상위 이하 청년",   amount: "매월 10만원 추가 적립",   link: "복지로(bokjiro.go.kr)" },
  { title: "국민취업지원제도",   cond: "구직 중인 만 15~69세",         amount: "월 50만원 · 6개월 지급",   link: "고용24(work24.go.kr)" },
  { title: "청년도약계좌",       cond: "만 19~34세 · 소득 요건 충족",  amount: "정부기여금 최대 6%",       link: "서민금융진흥원" },
];

export default function ChildApp() {
  // 자녀 앱도 은행 앱이므로 하단 탭은 부모 앱과 같다.
  // 안심동행 관련 화면(알림·설정)은 헤더 아이콘으로 들어간다.
  const [tab, setTab] = useState<Tab>("홈");
  const [page, setPage] = useState<"home" | "alert-detail" | "alerts" | "settings" | "history" | "transfer" | "guardian" | "emergency-loan" | "benefits">("home");
  // 페어링 완료 여부 — 완료 전에는 은행 앱만 보이고 안심동행 기능은 숨는다.
  const [paired, setPaired] = useState(() => localStorage.getItem("ansimPaired") === "true");
  const [response, setResponse] = useState<AlertResponse>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [protectionLevel] = useProtectionLevel();
  const protection = PROTECTION_LEVELS[protectionLevel];
  const [alert, setAlert] = useState<DemoAlert | null>(() => {
    const stored = localStorage.getItem("ansimAlert");
    return stored ? { ...DEMO_ALERT, ...JSON.parse(stored) } : DEMO_ALERT;
  });
  const [comingSoon, setComingSoon] = useState<string | null>(null);
  const [otherFinanceOpen, setOtherFinanceOpen] = useState(false);
  const [emergencyLoan, setEmergencyLoan] = useState(0);
  const [selectedBenefit, setSelectedBenefit] = useState<LifeBenefit | null>(null);

  // 실시간 잔액·거래내역 — 부모 앱과 동일하게, 송금하면 즉시 잔액이 깎이고 거래내역·알림에 뜬다.
  const [balanceOverride, setBalanceOverride] = useState<string | null>(null);
  const [extraTxns, setExtraTxns] = useState<TxnRow[]>([]);
  const liveAccount = { ...CHILD_ACCOUNT, balance: balanceOverride ?? CHILD_ACCOUNT.balance };

  // amount 가 양수면 입금, 음수면 출금 — 송금·비상금대출 실행/상환이 모두 이 함수 하나로 잔액·거래내역에 반영된다.
  const applyTxn = (amount: number, name: string, memo: string) => {
    const current = parseAmt(liveAccount.balance);
    const next = Math.max(0, current + amount);
    setBalanceOverride(next.toLocaleString("ko-KR"));

    const now = new Date();
    const date = `${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
    const time = now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
    const row: TxnRow = { date, time, name, memo, amount, balance: next };
    setExtraTxns((prev) => [row, ...prev]);
  };

  const handleTransferSuccess = (_fromIdx: number, amount: number, recipientName: string) => {
    applyTxn(-amount, recipientName, "이체");
  };

  const borrowEmergencyLoan = (amount: number) => {
    applyTxn(amount, "나눔은행 비상금대출", "대출입금");
    setEmergencyLoan((prev) => prev + amount);
  };

  const repayEmergencyLoan = () => {
    if (emergencyLoan <= 0) return;
    applyTxn(-emergencyLoan, "나눔은행 비상금대출", "대출상환");
    setEmergencyLoan(0);
  };

  // 부모 앱이 보류 상태가 되면 localStorage 로 알림이 넘어온다
  useEffect(() => {
    const id = setInterval(() => {
      const stored = localStorage.getItem("ansimAlert");
      if (stored) {
        const data = JSON.parse(stored);
        setAlert((prev) => ({ ...DEMO_ALERT, ...data, _ts: data._ts || (prev as any)?._ts }));
      }
    }, 1500);
    return () => clearInterval(id);
  }, []);

  // 같은 브라우저 안에서 부모·자녀 앱을 오가는 MVP에서도 연결 결과를 즉시 반영한다.
  useEffect(() => {
    const syncPairing = () => setPaired(localStorage.getItem("ansimPaired") === "true");
    window.addEventListener("ansim-paired", syncPairing);
    window.addEventListener("storage", syncPairing);
    return () => {
      window.removeEventListener("ansim-paired", syncPairing);
      window.removeEventListener("storage", syncPairing);
    };
  }, []);

  const a = alert as any;
  const amount  = a?.amount ?? DEMO_ALERT.amount;
  const account = a?.account ?? DEMO_ALERT.account;
  const time    = a?.time ?? DEMO_ALERT.time;
  const signals: string[] = a?.signals?.length ? a.signals : DEMO_ALERT.signals;
  const conversation = a?.conversation?.length ? a.conversation : DEMO_ALERT.conversation;

  // 알림을 처리하면 ansimAlert 는 지워지므로, 판단 이력은 별도 로그로 남긴다
  // (기록 목록은 안심동행 AI 페이지 = Guardian 에서 보여준다)
  const alertId = String(a?._ts ?? "demo-alert");

  useEffect(() => {
    if (!alert) return;
    openGuardianLogEntry({
      id: alertId,
      raisedAt: a?._ts ? new Date(a._ts).toISOString() : new Date().toISOString(),
      amount, account, bank: a?.bank ?? "", risk: a?.risk ?? "HIGH",
      signals, fraudTypeLabel: a?.fraudTypeLabel ?? "", conversation,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertId, !!alert]);

  // 상세 화면에 들어오면 '대화를 열어봤다'로 기록한다
  useEffect(() => {
    if (page === "alert-detail") markGuardianLogViewed(alertId);
  }, [page, alertId]);

  const respond = (r: Exclude<AlertResponse, null>) => {
    setResponse(r);
    recordGuardianDecision(alertId, r);
    setPage("home");
    localStorage.removeItem("ansimAlert");
    window.dispatchEvent(new Event("ansim-alert"));
  };

  return (
    <>
      {/* 헤더 색 = 계좌 박스 맨 위 색. 둘이 이어져 하나의 영역처럼 보인다 */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-5 py-4 bg-[#eff8f3]">
        {/* 부모 앱 헤더와 동일한 구성 — 은행 이름과 로고 색만 다르다 */}
        <button onClick={() => { setTab("홈"); setPage("home"); }} className="flex items-center gap-1.5 active:scale-95 transition-transform">
          <svg viewBox="0 0 24 24" fill="#2A9D6E" className="w-5 h-5"><path d="M12 2L2 7.5v1h20v-1L12 2z" /><path d="M4.5 9h2v8h-2zM9 9h2v8H9zM13 9h2v8h-2zM17.5 9h2v8h-2z" /><path d="M2 17h20v2H2z" /><circle cx="12" cy="5.2" r="0.8" fill="white" /></svg>
          <span className="text-[17px] font-bold text-gray-900 tracking-tight">나눔은행</span>
        </button>
        <div className="flex gap-2 items-center">
          <button className="text-gray-400"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></svg></button>
          <button onClick={() => setShowNotifications(true)} className="relative text-gray-400 active:scale-90 transition-transform">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M12 2a1.5 1.5 0 011.5 1.5v.3A6 6 0 0118 9.5c0 3.5 1 5.5 2 7 .3.4 0 1-.5 1H4.5c-.5 0-.8-.6-.5-1 1-1.5 2-3.5 2-7a6 6 0 014.5-5.7v-.3A1.5 1.5 0 0112 2z" /><path d="M9.5 17.5a2.5 2.5 0 005 0" /></svg>
            {paired && alert && !response && <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center"><span className="text-[9px] font-bold text-white">1</span></div>}
          </button>
        </div>
      </header>

      <main className="flex-1 px-3 pb-4">

        {/* ── 홈 ── */}
        {tab === "홈" && page === "home" && (
          <div className="flex flex-col gap-3 pt-3">

            {/* ── 나눔은행 계좌 (부모 앱과 다른 은행·다른 UI) ── */}
            <div className="-mx-3 -mt-3 px-4 pt-4 pb-5 rounded-b-[28px] bg-gradient-to-b from-[#eff8f3] via-[#f4faf7] to-white">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-[15px] font-bold text-gray-900">나눔은행</span>
                  <button onClick={() => setOtherFinanceOpen(true)} className="text-[15px] text-gray-400 active:scale-95 transition-transform">다른금융</button>
                </div>
                <button onClick={() => { setTab("금융"); setPage("home"); }} className="flex items-center gap-0.5 text-[13px] text-gray-500 active:scale-95 transition-transform">
                  전체계좌
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-3.5 h-3.5"><path d="M9 6l6 6-6 6" /></svg>
                </button>
              </div>

              <div className="bg-white rounded-2xl px-4 py-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-8 h-8 shrink-0 rounded-full bg-emerald-50 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" fill="#2A9D6E" className="w-4 h-4"><path d="M12 2L2 7.5v1h20v-1L12 2z" /><path d="M4.5 9h2v8h-2zM9 9h2v8H9zM13 9h2v8h-2zM17.5 9h2v8h-2z" /><path d="M2 17h20v2H2z" /></svg>
                    </span>
                    <span className="text-[16px] font-bold text-gray-900 truncate">{liveAccount.name}</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4 text-gray-400 shrink-0"><path d="M6 9l6 6 6-6" /></svg>
                  </div>
                  <button onClick={() => setPage("settings")} className="text-gray-300 shrink-0 active:scale-90 transition-transform">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></svg>
                  </button>
                </div>
                <p className="text-[12px] text-gray-400 mt-1 ml-10">나눔은행 {fmtAccount(liveAccount.account)}</p>

                <p className="text-[26px] font-bold text-gray-900 text-center mt-4 mb-4">{liveAccount.balance}원</p>

                <div className="border-t border-gray-100 pt-3 flex items-center">
                  <button onClick={() => setPage("history")} className="flex-1 py-1.5 rounded-xl text-[14px] font-semibold text-gray-900 hover:bg-emerald-50 active:scale-95 transition-all duration-200">거래내역</button>
                  <span className="w-px h-4 bg-gray-100" />
                  <button onClick={() => setPage("transfer")} className="flex-1 py-1.5 rounded-xl text-[14px] font-semibold text-gray-900 hover:bg-emerald-50 active:scale-95 transition-all duration-200">송금</button>
                </div>
              </div>

              <button onClick={() => { setTab("금융"); setPage("home"); }} className="w-full mt-3 flex justify-center text-gray-400 active:scale-90 transition-transform">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M6 9l6 6 6-6" /></svg>
              </button>
            </div>

            <p className="text-[17px] font-bold text-gray-900 px-1 pt-1">나눔서비스</p>

            {/* ── 안심동행 AI 배너 (기존 광고 자리) ── */}
            <div
              onClick={() => setPage("guardian")}
              className="rounded-2xl p-6 border border-[#dcece4] bg-gradient-to-br from-[#eff8f3] via-[#f4faf7] to-white flex items-center justify-between active:scale-[0.98] hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer"
            >
              <div>
                <p className="text-[14px] font-semibold text-[#3c7a63] mb-1">안심동행 AI</p>
                <p className="text-[20px] text-[#1f4a3a] leading-snug">부모님 금융을<br />가족이 함께 지켜요</p>
                <p className="text-[12px] text-[#4a8a72] mt-2">시작하기 &gt;</p>
              </div>
              <svg viewBox="0 0 48 48" fill="#2A9D6E" fillOpacity="0.35" className="w-28 h-28"><circle cx="14" cy="12" r="4.5" /><path d="M14 17c-4 0-7 3-7 7v6h14v-6c0-4-3-7-7-7z" /><circle cx="34" cy="12" r="4.5" /><path d="M34 17c-4 0-7 3-7 7v6h14v-6c0-4-3-7-7-7z" /><circle cx="24" cy="20" r="3.5" /><path d="M24 24c-3 0-5.5 2.5-5.5 5.5V36h11v-6.5c0-3-2.5-5.5-5.5-5.5z" /></svg>
            </div>

            {/* 서비스 전체 현황 — 부모 앱과 동일한 지표 */}
            <div className="bg-white border border-gray-100 rounded-2xl p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all">
              <p className="text-[14px] font-bold text-gray-900 mb-3">안심동행 현황</p>
              <div className="flex justify-around text-center">
                {[["127건", "오늘 보호된 거래"], ["99.2%", "사기 탐지율"], ["1.2초", "평균 분석 속도"]].map(([v, l], i) => (
                  <div key={l} className={`${i > 0 ? "border-l border-gray-100 pl-4" : ""} flex-1`}>
                    <p className="text-[18px] font-bold text-gray-900">{v}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{l}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 나눔은행 서비스 4종 — 부모 앱 금융상품 버튼과 같은 형태 */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { title: "금융상품",    desc: "예금·적금·대출",     onClick: () => { setTab("상품"); setPage("home"); } },
                { title: "자산관리",    desc: "내 자산 한눈에",     onClick: () => { setTab("금융"); setPage("home"); } },
                { title: "비상금",      desc: "급할 때 소액 대출",   onClick: () => setPage("emergency-loan") },
                { title: "생활 지원금", desc: "정부 지원금 조회",    onClick: () => setPage("benefits") },
              ].map((s) => (
                <button key={s.title} onClick={s.onClick} className="bg-emerald-50/60 rounded-xl p-4 text-left active:scale-95 hover:bg-emerald-100/60 hover:-translate-y-0.5 hover:shadow-md transition-all">
                  <p className="text-[14px] font-semibold text-gray-900">{s.title}</p>
                  <p className="text-[12px] text-gray-400 mt-1">{s.desc}</p>
                </button>
              ))}
            </div>

            {/* ── 안심동행 기능 — 페어링 완료 후에만 나타난다 ── */}
            {paired && (<>
            {alert && !response ? (
              <button onClick={() => setPage("alert-detail")} className="w-full bg-red-50 border-2 border-red-200 rounded-2xl p-5 text-left active:scale-[0.98] hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center"><svg viewBox="0 0 24 24" fill="#ef4444" className="w-4 h-4"><path d="M12 2L2 21h20L12 2zm0 3.5L19.5 19h-15L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z" /></svg></div>
                    <span className="text-[13px] font-bold text-red-700">확인이 필요해요</span>
                  </div>
                  <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">HIGH</span>
                </div>
                <p className="text-[15px] font-bold text-gray-900 mb-1">어머니 위험 거래 감지</p>
                <p className="text-[13px] text-gray-600">{amount.toLocaleString()}원 → {account}</p>
                <p className="text-[12px] text-gray-400 mt-1">AI가 모순을 감지했어요</p>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-[12px] text-red-500 font-semibold">자세히 보기 →</p>
                  <p className="text-[11px] text-gray-400">{time}</p>
                </div>
              </button>
            ) : response ? (
              <div className={`rounded-2xl p-5 ${response === "held" ? "bg-amber-50 border border-amber-200" : "bg-green-50 border border-green-200"}`}>
                <p className={`text-[14px] font-bold mb-1 ${response === "held" ? "text-amber-700" : "text-green-700"}`}>
                  {response === "held" ? "⏸ 보류 처리됨" : "✅ 승인 처리됨"}
                </p>
                <p className="text-[12px] text-gray-500">어머니의 송금이 {response === "held" ? "24시간 지연되었어요" : "승인되었어요"}.</p>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
                <div className="flex items-center gap-2">
                  <svg viewBox="0 0 24 24" fill="#22c55e" className="w-5 h-5"><path d="M20 6L9 17l-5-5" /></svg>
                  <p className="text-[14px] font-bold text-green-700">이번 주 이상 없어요</p>
                </div>
                <p className="text-[12px] text-gray-400 mt-1">어머니의 거래가 모두 정상이에요 ✅</p>
              </div>
            )}

            <button onClick={() => setPage("guardian")} className="w-full bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 text-left hover:shadow-md active:scale-[0.98] transition-all">
              <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-[15px] font-bold text-green-700">영</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[14px] font-bold text-gray-900">어머니와 연결됨</p>
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                </div>
                <p className="text-[12px] text-gray-400 mt-0.5">Lv.{protectionLevel} {protection.name} · 현재 보호 중</p>
              </div>
              <span className="text-[12px] font-semibold text-[var(--ac-500)]">자세히</span>
            </button>
            </>)}
          </div>
        )}

        {/* ── 금융 / 상품 / 혜택 / 주식 탭 — 부모 앱과 같은 화면을 재사용 ── */}
        {tab === "금융" && page === "home" && (
          <FinancialTab accounts={[liveAccount]} onAccount={() => setPage("history")} />
        )}
        {tab === "상품" && page === "home" && (
          <ProductsTab showOwned={false} />
        )}
        {tab === "혜택" && page === "home" && <BenefitsTab />}
        {tab === "주식" && page === "home" && <StocksTab role="child" />}

        {/* ── 거래내역 · 송금 (부모 앱과 같은 화면, 색만 나눔은행) ── */}
        {page === "history" && (
          <History
            account={liveAccount}
            theme="child"
            onBack={() => setPage("home")}
            onTransfer={() => setPage("transfer")}
            onGuardian={() => setPage("settings")}
            extraRows={extraTxns}
          />
        )}
        {page === "transfer" && <Transfer onExit={() => setPage("home")} accounts={[liveAccount]} onSuccess={handleTransferSuccess} />}
        {page === "guardian" && <Guardian appRole="child" onExit={() => setPage("home")} />}

        {/* ── 위험 이벤트 상세 ── */}
        {page === "alert-detail" && alert && (
          <div className="flex flex-col gap-3 pt-2">
            <div className="flex items-center gap-3 py-2">
              <button onClick={() => setPage("home")} className="text-gray-500 active:scale-90">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <p className="text-[17px] font-bold text-gray-900">위험 이벤트 상세</p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[15px] font-bold text-red-700">⚠️ 어머니 위험 거래 감지</p>
                <span className="bg-red-500 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">HIGH</span>
              </div>
              <div className="bg-white rounded-xl p-4 flex flex-col gap-2 text-[13px]">
                {[
                  ["금액", `${amount.toLocaleString()}원`],
                  ["수취 계좌", account],
                  ["수취 은행", a?.bank ?? DEMO_ALERT.bank],
                  ["시각", time],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-gray-400">{k}</span>
                    <span className={`font-medium ${k === "금액" ? "font-bold text-red-600" : "text-gray-800"}`}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <p className="text-[13px] font-bold text-gray-700 mb-3">AI 분석 결과</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {signals.map((s) => <span key={s} className="bg-red-50 text-red-600 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-red-100">{s}</span>)}
              </div>
              <p className="text-[12px] text-gray-500 leading-relaxed bg-gray-50 rounded-xl p-3">{a?.aiSummary ?? DEMO_ALERT.aiSummary}</p>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <p className="text-[13px] font-bold text-gray-700 mb-3">AI · 어머니 대화 내용</p>
              <div className="flex flex-col gap-2">
                {conversation.map((msg: { role: string; text: string }, i: number) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "ai" && <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center mr-2 shrink-0 mt-0.5"><svg viewBox="0 0 24 24" fill="#3b82f6" className="w-3.5 h-3.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7z" /></svg></div>}
                    <div className={`max-w-[80%] px-3 py-2 rounded-xl text-[12px] whitespace-pre-line leading-relaxed ${msg.role === "ai" ? "bg-blue-50 text-gray-800 rounded-tl-sm" : "bg-gray-100 text-gray-700 rounded-tr-sm"}`}>{msg.text}</div>
                  </div>
                ))}
              </div>
            </div>

            {!response ? (
              <div className="flex flex-col gap-2">
                <a href="tel:010-0000-0000" className="w-full py-3.5 rounded-xl text-[15px] font-semibold text-white bg-blue-500 active:scale-[0.98] transition-all text-center block">📞 어머니께 전화하기</a>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => respond("approved")} className="py-3 rounded-xl text-[14px] font-semibold text-gray-900 border-2 border-blue-200 bg-blue-50 active:scale-[0.98] transition-all">✅ 승인</button>
                  <button onClick={() => respond("held")} className="py-3 rounded-xl text-[14px] font-semibold text-red-600 border-2 border-red-200 bg-red-50 active:scale-[0.98] transition-all">⏸ 보류</button>
                </div>
                <p className="text-[11px] text-gray-400 text-center">승인 시 어머니 최종 확인 후 송금 / 보류 시 24시간 지연</p>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
                <p className="text-[15px] font-bold text-green-700">{response === "held" ? "보류 처리 완료" : "승인 완료"}</p>
                <p className="text-[12px] text-gray-500 mt-1">어머니께 결과가 전달되었어요</p>
                <button onClick={() => setPage("home")} className="mt-3 text-[13px] text-gray-900 font-medium">홈으로 돌아가기</button>
              </div>
            )}
          </div>
        )}

        {/* ── 알림 ── */}
        {page === "alerts" && (
          <div className="flex flex-col gap-3 pt-2">
            <div className="flex items-center gap-3 py-2">
              <button onClick={() => setPage("home")} className="text-gray-500 active:scale-90">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <p className="text-[17px] font-bold text-gray-900">알림</p>
            </div>
            {alert ? (
              <button onClick={() => { setTab("홈"); setPage("alert-detail"); }} className="w-full bg-white border border-gray-100 rounded-2xl p-4 text-left active:scale-[0.98] hover:shadow-md transition-all">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0"><svg viewBox="0 0 24 24" fill="#ef4444" className="w-4 h-4"><path d="M12 2L2 21h20L12 2zm0 3.5L19.5 19h-15L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z" /></svg></div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-bold text-gray-900">어머니 위험 거래 감지</p>
                      <p className="text-[11px] text-gray-400">{time}</p>
                    </div>
                    <p className="text-[12px] text-gray-500 mt-0.5">{amount.toLocaleString()}원 · {signals[0]} · HIGH</p>
                    {response && <p className="text-[11px] text-green-600 mt-1 font-medium">{response === "held" ? "보류 처리됨" : "승인 처리됨"}</p>}
                  </div>
                </div>
              </button>
            ) : (
              <div className="text-center py-12"><p className="text-gray-400 text-[14px]">새로운 알림이 없어요</p></div>
            )}
          </div>
        )}

        {/* ── 설정 ── */}
        {page === "settings" && (
          <div className="flex flex-col gap-3 pt-2">
            <div className="flex items-center gap-3 py-2">
              <button onClick={() => setPage("home")} className="text-gray-500 active:scale-90">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <p className="text-[17px] font-bold text-gray-900">설정</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <p className="text-[13px] font-bold text-gray-400 mb-4">내 정보</p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-[18px] font-bold text-gray-900">지</div>
                <div><p className="text-[16px] font-bold text-gray-900">김지혜</p><p className="text-[12px] text-gray-400">자녀 계정</p></div>
              </div>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <p className="text-[13px] font-bold text-gray-400 mb-4">안심동행 권한 레벨</p>
              <div className="flex flex-col gap-3">
                {PROTECTION_LEVELS.map((item) => {
                  const active = protectionLevel === item.level;
                  return (
                  <div key={item.level} className={`flex items-center gap-3 p-3 rounded-xl ${active ? "bg-blue-50 border border-blue-200" : "bg-gray-50"}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${active ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-500"}`}>Lv.{item.level}</div>
                    <div>
                      <p className={`text-[13px] font-bold ${active ? "text-gray-900" : "text-gray-700"}`}>{item.name}{active && " (현재)"}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-400 text-center mt-3">권한은 부모님이 설정하고 언제든 회수 가능해요</p>
            </div>
          </div>
        )}

        {/* ── 비상금대출 ── */}
        {page === "emergency-loan" && (
          <div className="flex flex-col gap-4 pt-2 pb-6">
            <div className="flex items-center gap-3 py-2">
              <button onClick={() => setPage("home")} className="text-gray-500 active:scale-90">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <p className="text-[17px] font-bold text-gray-900">비상금대출</p>
            </div>

            <div className="bg-gradient-to-br from-[#2A9D6E] via-emerald-500 to-teal-400 rounded-2xl p-6">
              <p className="text-white/70 text-[12px]">이용 가능 한도</p>
              <p className="text-white text-[30px] font-black">{(EMERGENCY_LIMIT - emergencyLoan).toLocaleString()}원</p>
              <p className="text-white/60 text-[12px] mt-1">한도 {EMERGENCY_LIMIT.toLocaleString()}원 · 연 5.9%</p>
            </div>

            {emergencyLoan > 0 ? (
              <div className="bg-white rounded-2xl p-5 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <span className="text-[13px] text-gray-400">이용중인 비상금</span>
                  <span className="text-[18px] font-black text-gray-900">{emergencyLoan.toLocaleString()}원</span>
                </div>
                <button
                  onClick={repayEmergencyLoan}
                  className="w-full py-3.5 rounded-xl text-[15px] font-bold text-white bg-[#2A9D6E] active:scale-[0.98] transition-all"
                >
                  전액 상환하기
                </button>
                <p className="text-[11px] text-gray-400 text-center -mt-2">상환하면 입출금 계좌에서 바로 빠져나가요</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-5 flex flex-col gap-4">
                <p className="text-[14px] font-bold text-gray-900">얼마를 빌릴까요?</p>
                <div className="grid grid-cols-3 gap-2">
                  {[100_000, 300_000, 500_000].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => borrowEmergencyLoan(amt)}
                      className="py-3 rounded-xl text-[14px] font-semibold text-gray-900 bg-emerald-50 hover:bg-emerald-100 active:scale-95 transition-all"
                    >
                      {(amt / 10_000).toLocaleString()}만원
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 text-center">신청 즉시 입출금 계좌로 입금돼요</p>
              </div>
            )}
          </div>
        )}

        {/* ── 생활 지원금 조회 ── */}
        {page === "benefits" && (
          <div className="flex flex-col gap-3 pt-2 pb-6">
            <div className="flex items-center gap-3 py-2">
              <button onClick={() => setPage("home")} className="text-gray-500 active:scale-90">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <p className="text-[17px] font-bold text-gray-900">생활 지원금</p>
            </div>
            <p className="text-[13px] text-gray-400 px-1">지금 신청할 수 있는 정부 지원금이에요</p>
            <div className="flex flex-col gap-2">
              {LIFE_BENEFITS.map((b) => (
                <button
                  key={b.title}
                  onClick={() => setSelectedBenefit(b)}
                  className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center justify-between text-left hover:shadow-md active:scale-[0.98] transition-all"
                >
                  <div>
                    <p className="text-[14px] font-bold text-gray-900">{b.title}</p>
                    <p className="text-[12px] text-gray-400 mt-1">{b.cond}</p>
                  </div>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4 text-gray-300 shrink-0"><path d="M9 6l6 6-6 6" /></svg>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ─── 다른 금융기관 계좌 바텀시트 ───────────────────────────────────── */}
      {otherFinanceOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            style={{ animation: "fade-in 180ms ease-out both" }}
            onClick={() => setOtherFinanceOpen(false)}
          />
          <div
            className="absolute bottom-0 left-0 right-0 mx-auto w-full bg-white rounded-t-3xl px-5 pt-5 pb-8"
            style={{ maxWidth: 430, animation: "sheet-up 240ms cubic-bezier(.2,.8,.2,1) both" }}
          >
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5" />
            <p className="text-[18px] font-bold text-gray-900 mb-1">다른 금융기관 계좌</p>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" className="w-7 h-7">
                  <rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" />
                </svg>
              </div>
              <p className="text-[14px] font-semibold text-gray-500">연결된 다른 금융기관이 없어요</p>
              <p className="text-[12px] text-gray-400 mt-1">계좌를 연결하면 여기서 한번에 볼 수 있어요</p>
            </div>
            <button
              onClick={() => { setOtherFinanceOpen(false); setComingSoon("계좌 연결"); }}
              className="w-full py-4 rounded-xl text-[16px] font-bold text-white bg-[#2A9D6E] active:scale-[0.98] transition-all"
            >
              계좌 연결하기
            </button>
          </div>
        </div>
      )}

      {/* ─── 생활 지원금 상세 바텀시트 ─────────────────────────────────────── */}
      {selectedBenefit && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            style={{ animation: "fade-in 180ms ease-out both" }}
            onClick={() => setSelectedBenefit(null)}
          />
          <div
            className="absolute bottom-0 left-0 right-0 mx-auto w-full bg-white rounded-t-3xl px-5 pt-5 pb-8"
            style={{ maxWidth: 430, animation: "sheet-up 240ms cubic-bezier(.2,.8,.2,1) both" }}
          >
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5" />
            <p className="text-[20px] font-bold text-gray-900">{selectedBenefit.title}</p>
            <p className="text-[13px] text-gray-400 mt-1">{selectedBenefit.cond}</p>
            <div className="bg-gray-50 rounded-2xl p-4 my-4 flex items-center justify-between">
              <span className="text-[13px] text-gray-500">지원 내용</span>
              <span className="text-[13px] font-semibold text-gray-900">{selectedBenefit.amount}</span>
            </div>
            <p className="text-[12px] text-gray-400 text-center mb-4">{selectedBenefit.link}에서 신청할 수 있어요</p>
            <button
              onClick={() => setSelectedBenefit(null)}
              className="w-full py-4 rounded-xl text-[16px] font-bold text-white bg-[#2A9D6E] active:scale-[0.98] transition-all"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* ─── 준비 중 서비스 바텀시트 (계좌 연결 등 외부 인증이 필요한 기능) ───── */}
      {comingSoon && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            style={{ animation: "fade-in 180ms ease-out both" }}
            onClick={() => setComingSoon(null)}
          />
          <div
            className="absolute bottom-0 left-0 right-0 mx-auto w-full bg-white rounded-t-3xl px-5 pt-5 pb-8"
            style={{ maxWidth: 430, animation: "sheet-up 240ms cubic-bezier(.2,.8,.2,1) both" }}
          >
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5" />
            <p className="text-[18px] font-bold text-gray-900">{comingSoon}</p>
            <p className="text-[13px] text-gray-500 mt-2">곧 만나보실 수 있어요. 조금만 기다려주세요!</p>
            <button
              onClick={() => setComingSoon(null)}
              className="w-full mt-6 py-4 rounded-xl text-[16px] font-bold text-white active:scale-[0.98] transition-all"
              style={{ background: "var(--ac-500)" }}
            >
              확인
            </button>
          </div>
        </div>
      )}

      <nav className="sticky bottom-0 bg-white rounded-[28px] flex justify-around py-2 pt-3 mt-4">
        {parentTabs.map((t) => (
          <button key={t} onClick={() => { setTab(t); setPage("home"); }}
            className={`flex flex-col items-center gap-1 text-[11px] py-1 px-3 ${tab === t && page === "home" ? "text-gray-900 font-semibold" : "text-gray-400"}`}>
            {parentIcons[t]}{t}
          </button>
        ))}
      </nav>
      {showNotifications && (
        <NotificationShade
          role="child"
          hasRiskAlert={paired && Boolean(alert) && !response}
          onClose={() => setShowNotifications(false)}
          onOpenRiskAlert={() => { setShowNotifications(false); setPage("alert-detail"); }}
          extraTxns={extraTxns}
        />
      )}
    </>
  );
}
