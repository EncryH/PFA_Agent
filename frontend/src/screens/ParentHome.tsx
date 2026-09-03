// 부모 앱 홈 — 계좌 목록, 안심동행 배너, 현황, 금융상품

import { useEffect, useState } from "react";
import { MY_ACCOUNTS } from "../shared/data";
import { MONTHLY_SPENDING_TOTAL } from "../shared/monthlySpending";
import { BankLogo } from "../shared/ui";
import { PROTECTION_LEVELS, getProtectionDisplayLevel, useProtectionLevel } from "../shared/protection";

const PRODUCTS = [
  { title: "안심 정기예금",    desc: "연 3.5% · 12개월" },
  { title: "내일채움 적금",    desc: "월 30만원부터" },
  { title: "안심 신용대출",    desc: "최저 연 4.2%" },
  { title: "주택청약종합저축", desc: "비과세 · 소득공제" },
];

function AnsimBanner({ paired, onClick, onVerify, protectionLevel, protectionName }: { paired: boolean; onClick: () => void; onVerify?: () => void; protectionLevel?: number; protectionName?: string }) {
  if (paired) {
    return (
      <div onClick={onClick} className="mt-3 rounded-2xl bg-gradient-to-br from-blue-700 via-blue-500 to-cyan-400 p-5 active:scale-[0.98] hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[15px] font-bold text-white">안심동행 AI</p>
        </div>
        <p className="text-[12px] text-white/70 mb-4">딸 김지혜님과 함께 지키고 있어요.</p>
        <div className="rounded-xl border border-transparent bg-white/15 backdrop-blur-sm p-4 flex items-center justify-between transition-all duration-200 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/25 hover:shadow-lg active:translate-y-0 active:scale-[0.99]">
          <div className="flex flex-col items-center flex-1">
            <div className="w-11 h-11 rounded-full bg-white/25 flex items-center justify-center mb-1.5">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5"><circle cx="12" cy="8" r="4" stroke="white" strokeWidth="1.8" /><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke="white" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </div>
            <p className="text-[13px] font-bold text-white">김영순</p>
            <p className="text-[11px] text-white/60">한결은행</p>
            <p className="text-[10px] text-white/40">부모</p>
          </div>
          <div className="flex flex-col items-center px-4">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke="white" strokeWidth="2" strokeLinecap="round" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>
            </div>
            <p className="text-[10px] text-white/70 font-medium mt-1">안심동행</p>
          </div>
          <div className="flex flex-col items-center flex-1">
            <div className="w-11 h-11 rounded-full bg-white/25 flex items-center justify-center mb-1.5">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5"><circle cx="12" cy="8" r="4" stroke="white" strokeWidth="1.8" /><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke="white" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </div>
            <p className="text-[13px] font-bold text-white">김지혜</p>
            <p className="text-[11px] text-white/60">나눔은행</p>
            <p className="text-[10px] text-white/40">자녀</p>
          </div>
        </div>
        {protectionLevel !== undefined && protectionName && (
          <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-between">
            <span className="text-[12px] text-white/60">현재 가족 보호</span>
            <span className="text-[12px] font-semibold text-white">Lv.{getProtectionDisplayLevel(protectionLevel)} {protectionName}</span>
          </div>
        )}
        {onVerify && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onVerify(); }}
            className="group mt-3 w-full cursor-pointer flex items-center gap-3 rounded-xl border border-transparent bg-white/15 backdrop-blur-sm px-4 py-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/25 hover:shadow-lg active:translate-y-0 active:scale-[0.98]"
          >
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110">
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4"><circle cx="11" cy="11" r="7" stroke="white" strokeWidth="1.8" /><path d="M21 21l-4.35-4.35" stroke="white" strokeWidth="1.8" strokeLinecap="round" /><path d="M11 8v3m0 3h.01" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-white">상대방 검증</p>
              <p className="text-[11px] text-white/50">번호·링크·기관명 안전 여부 확인</p>
            </div>
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1"><path d="M9 18l6-6-6-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        )}
      </div>
    );
  }
  return (
    <div onClick={onClick} className="mt-3 rounded-2xl p-6 bg-gradient-to-br from-blue-700 via-blue-500 to-cyan-400 flex items-center justify-between active:scale-[0.98] hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer">
      <div>
        <p className="text-[14px] font-semibold text-white mb-1">안심동행 AI</p>
        <p className="text-[20px] text-white leading-snug">부모님 금융을<br />가족이 함께 지켜요</p>
        <p className="text-[12px] text-white mt-2">시작하기 &gt;</p>
      </div>
      <svg viewBox="0 0 48 48" fill="white" fillOpacity="0.9" className="w-28 h-28"><circle cx="14" cy="12" r="4.5" /><path d="M14 17c-4 0-7 3-7 7v6h14v-6c0-4-3-7-7-7z" /><circle cx="34" cy="12" r="4.5" /><path d="M34 17c-4 0-7 3-7 7v6h14v-6c0-4-3-7-7-7z" /><circle cx="24" cy="20" r="3.5" /><path d="M24 24c-3 0-5.5 2.5-5.5 5.5V36h11v-6.5c0-3-2.5-5.5-5.5-5.5z" /></svg>
    </div>
  );
}

type ProductDetail = {
  title: string;
  desc: string;
  details: { label: string; value: string }[];
  tagline: string;
  /** deposit·savings = 신청하면 입출금 계좌에서 즉시 이체돼요. loan = 심사 신청만 접수돼요. */
  kind: "deposit" | "savings" | "loan";
  minAmount?: number;
};

const PRODUCT_DETAILS: Record<string, ProductDetail> = {
  "안심 정기예금": {
    title: "안심 정기예금",
    desc: "연 3.5% · 12개월",
    details: [
      { label: "가입기간", value: "12개월" },
      { label: "금리",     value: "연 3.5%" },
      { label: "최소금액", value: "100만원" },
    ],
    tagline: "예치금을 안전하게 운용하세요",
    kind: "deposit",
    minAmount: 1_000_000,
  },
  "내일채움 적금": {
    title: "내일채움 적금",
    desc: "월 30만원부터",
    details: [
      { label: "가입기간", value: "12~36개월" },
      { label: "금리",     value: "연 4.2%" },
      { label: "납입금액", value: "월 30만원부터" },
    ],
    tagline: "매월 꾸준히 모아가세요",
    kind: "savings",
    minAmount: 300_000,
  },
  "안심 신용대출": {
    title: "안심 신용대출",
    desc: "최저 연 4.2%",
    details: [
      { label: "한도",     value: "최대 3천만원" },
      { label: "금리",     value: "최저 연 4.2%" },
      { label: "상환방식", value: "원리금균등" },
    ],
    tagline: "급할 때 빠르게 신청하세요",
    kind: "loan",
  },
  "주택청약종합저축": {
    title: "주택청약종합저축",
    desc: "비과세 · 소득공제",
    details: [
      { label: "세금혜택", value: "비과세" },
      { label: "소득공제", value: "연말정산" },
      { label: "최소납입", value: "월 2만원부터" },
    ],
    tagline: "내 집 마련의 첫걸음",
    kind: "savings",
    minAmount: 20_000,
  },
};

export default function ParentHome({
  onTransfer, onGuardian, onAccount, onVerify, onSupport, onPrivacy, onLimitIncrease,
  onAllAccounts, onMonthlyDetail, accounts = MY_ACCOUNTS, largeText,
  onSubscribe, openProductKey, onProductOpened,
}: {
  onTransfer: (fromIdx: number) => void;
  onGuardian: () => void;
  onAccount: (i: number) => void;
  onVerify: () => void;
  onSupport: () => void;
  onPrivacy: () => void;
  onLimitIncrease: () => void;
  onAllAccounts?: () => void;
  onMonthlyDetail?: () => void;
  accounts?: typeof MY_ACCOUNTS;
  largeText: boolean;
  /** 예금·적금 신청 확정 시 입출금 계좌에서 실제로 돈을 빼는 건 App 이 담당한다. */
  onSubscribe: (amount: number, productTitle: string) => void;
  /** 검색에서 특정 상품을 바로 열 때 App 이 넘겨준다. */
  openProductKey?: string | null;
  onProductOpened?: () => void;
}) {
  const [paired, setPaired] = useState(() => localStorage.getItem("ansimPaired") === "true");
  const [protectionLevel] = useProtectionLevel();
  const protection = PROTECTION_LEVELS[protectionLevel];
  const [selectedProduct, setSelectedProduct] = useState<ProductDetail | null>(null);
  const [applyStep, setApplyStep] = useState<"detail" | "amount" | "done">("detail");
  const [applyAmount, setApplyAmount] = useState("");

  useEffect(() => {
    if (!openProductKey) return;
    const product = PRODUCT_DETAILS[openProductKey];
    if (product) {
      setSelectedProduct(product);
      setApplyStep("detail");
      setApplyAmount(product.minAmount ? product.minAmount.toLocaleString("ko-KR") : "");
    }
    onProductOpened?.();
  }, [openProductKey, onProductOpened]);

  useEffect(() => {
    const syncPairing = () => setPaired(localStorage.getItem("ansimPaired") === "true");
    window.addEventListener("ansim-paired", syncPairing);
    window.addEventListener("storage", syncPairing);
    return () => {
      window.removeEventListener("ansim-paired", syncPairing);
      window.removeEventListener("storage", syncPairing);
    };
  }, []);

  if (largeText) {
    const mainAccount = accounts[0];

    return (
      <div className="flex flex-col gap-4 pt-2">
        <div className="px-1">
          <p className="text-[24px] font-bold text-gray-900">김영순님, 안녕하세요</p>
          <p className="mt-1 text-[16px] text-gray-600">원하시는 메뉴를 눌러주세요.</p>
        </div>

        <section className="rounded-3xl border-2 border-blue-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <BankLogo bank={mainAccount.bank} size={42} />
            <div>
              <p className="text-[18px] font-bold text-gray-900">내 입출금 통장</p>
              <p className="mt-1 text-[15px] text-gray-500">한결은행 · 110-1234-567</p>
            </div>
          </div>
          <p className="my-6 text-center text-[32px] font-bold tracking-tight text-gray-950">{mainAccount.balance}원</p>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => onAccount(0)} className="min-h-16 rounded-2xl border-2 border-blue-200 bg-blue-50 text-[18px] font-bold text-blue-800 active:scale-[0.98] transition-transform">거래내역 보기</button>
            <button onClick={() => onTransfer(0)} className="min-h-16 rounded-2xl bg-blue-600 text-[18px] font-bold text-white active:scale-[0.98] transition-transform">송금하기</button>
          </div>
        </section>

        <AnsimBanner paired={paired} onClick={onGuardian} onVerify={onVerify} protectionLevel={protectionLevel} protectionName={protection.name} />

        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="text-[20px] font-bold text-gray-900">금융상품</h2>
          <p className="mt-1 text-[15px] text-gray-500">필요한 상품을 쉽고 크게 확인하세요.</p>
          <div className="mt-4 flex flex-col gap-3">
            {PRODUCTS.slice(0, 2).map((product) => (
              <button key={product.title} className="flex min-h-16 items-center justify-between rounded-2xl bg-blue-50 px-5 py-4 text-left active:scale-[0.98] transition-transform">
                <span><span className="block text-[17px] font-bold text-gray-900">{product.title}</span><span className="mt-1 block text-[14px] text-gray-600">{product.desc}</span></span>
                <span className="text-[24px] text-blue-600">›</span>
              </button>
            ))}
          </div>
          <button className="mt-3 min-h-14 w-full rounded-2xl border-2 border-gray-200 text-[17px] font-bold text-gray-700">금융상품 모두 보기</button>
        </section>

        <button onClick={onSupport} className="min-h-16 w-full rounded-2xl bg-white p-5 shadow-sm flex items-center justify-between active:scale-[0.98] transition-transform">
          <span className="text-[18px] font-bold text-gray-900">고객센터</span>
          <span className="text-[16px] font-bold text-blue-600">문의하기 ›</span>
        </button>

        <button onClick={onPrivacy} className="py-3 text-[13px] text-gray-300 text-center active:scale-95 transition-transform">
          개인정보처리방침
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl p-5 flex flex-col gap-4 hover:shadow-lg transition-all duration-200">
        {accounts.map((acc, i) => (
          <div key={acc.name} className="group flex items-center justify-between rounded-xl -mx-2 px-2 -my-2 py-2 hover:bg-blue-50/50 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
            <button onClick={() => onAccount(i)} className="flex items-center gap-3 flex-1 min-w-0 text-left active:scale-[0.98] transition-transform">
              <span className="transition-transform duration-200 group-hover:scale-105">
                <BankLogo bank={acc.bank} size={30} />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] text-gray-500 truncate">{acc.name}</p>
                <p className="text-[18px] font-bold text-gray-900">{acc.balance}원</p>
              </div>
            </button>
            <button onClick={() => onTransfer(i)} className="shrink-0 ml-2 text-[13px] text-gray-900 bg-blue-50 rounded-md px-4 py-1.5 font-medium active:scale-95 hover:bg-blue-100 transition-all">
              송금
            </button>
          </div>
        ))}
        <button
          onClick={() => onAllAccounts?.()}
          className="text-[13px] text-gray-400 text-center pt-2 border-t border-gray-100 active:text-blue-500 transition-colors"
        >
          모두보기
        </button>
      </div>

      <button
        type="button"
        onClick={onMonthlyDetail}
        className="mt-3 flex w-full items-center justify-between rounded-2xl bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99]"
        aria-label="9월 이용 내역 보기"
      >
        <div>
          <p className="text-[18px] font-bold text-gray-900">{MONTHLY_SPENDING_TOTAL.toLocaleString("ko-KR")}원</p>
          <p className="text-[13px] text-gray-400">9월 이용 금액</p>
        </div>
        <span className="flex items-center gap-1 rounded-md bg-gray-100 px-4 py-1.5 text-[13px] font-medium text-gray-500">
          내역
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
        </span>
      </button>

      <AnsimBanner paired={paired} onClick={onGuardian} onVerify={onVerify} protectionLevel={protectionLevel} protectionName={protection.name} />


      <div className="mt-3 bg-white rounded-2xl p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all">
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

      {/* 이체한도 상향 */}
      <button onClick={onLimitIncrease} className="w-full mt-3 bg-white rounded-2xl p-4 flex items-center gap-4 text-left hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all">
        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-[14px] font-bold text-gray-900">이체한도 관리</p>
          <p className="text-[12px] text-gray-400 mt-0.5">1일 이체한도 상향하기</p>
        </div>
        <span className="text-[12px] font-semibold text-blue-500">관리하기</span>
      </button>

      <button onClick={onSupport} className="w-full mt-3 bg-white rounded-2xl p-4 flex items-center gap-4 text-left hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all">
        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12c0 1.821.487 3.53 1.338 5L2 22l5-1.338A9.955 9.955 0 0012 22z" />
            <path d="M9.5 9a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 3.5M12 16.5h.01" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-[14px] font-bold text-gray-900">고객센터</p>
          <p className="text-[12px] text-gray-400 mt-0.5">자주 묻는 질문 · 전화 상담 · 1:1 문의</p>
        </div>
        <span className="text-[12px] font-semibold text-blue-500">문의하기</span>
      </button>

      <div className="mt-3 bg-white rounded-2xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all">
        <p className="text-[16px] font-bold text-gray-900 mb-4">금융상품</p>
        <div className="grid grid-cols-2 gap-3">
          {PRODUCTS.map((p) => (
            <button
              key={p.title}
              onClick={() => {
                const product = PRODUCT_DETAILS[p.title] ?? null;
                setSelectedProduct(product);
                setApplyStep("detail");
                setApplyAmount(product?.minAmount ? product.minAmount.toLocaleString("ko-KR") : "");
              }}
              className="bg-blue-50/60 rounded-xl p-4 text-left active:scale-95 hover:bg-blue-100/60 hover:-translate-y-0.5 hover:shadow-md transition-all"
            >
              <p className="text-[14px] font-semibold text-gray-900">{p.title}</p>
              <p className="text-[12px] text-gray-400 mt-1">{p.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <button onClick={onPrivacy} className="w-full py-4 mt-1 text-[12px] text-gray-300 text-center active:scale-95 transition-transform">
        개인정보처리방침
      </button>

      {/* ─── 금융상품 상세 바텀시트 (상세 → 금액 입력 → 완료) ────────────── */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            style={{ animation: "fade-in 180ms ease-out both" }}
            onClick={() => { setSelectedProduct(null); setApplyStep("detail"); }}
          />
          <div
            className="absolute bottom-0 left-0 right-0 mx-auto w-full bg-white rounded-t-3xl px-5 pt-5 pb-8"
            style={{ maxWidth: 430, animation: "sheet-up 240ms cubic-bezier(.2,.8,.2,1) both" }}
          >
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5" />

            {applyStep === "detail" && (
              <>
                <p className="text-[20px] font-bold text-gray-900">{selectedProduct.title}</p>
                <p className="text-[13px] text-gray-400 mt-1">{selectedProduct.desc}</p>
                <p className="text-[14px] text-blue-600 font-semibold mt-3 mb-4">{selectedProduct.tagline}</p>
                <div className="flex flex-col gap-3 bg-gray-50 rounded-2xl p-4 mb-5">
                  {selectedProduct.details.map((d) => (
                    <div key={d.label} className="flex items-center justify-between">
                      <span className="text-[13px] text-gray-500">{d.label}</span>
                      <span className="text-[13px] font-semibold text-gray-900">{d.value}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setApplyStep(selectedProduct.kind === "loan" ? "done" : "amount")}
                  className="w-full py-4 rounded-xl text-[16px] font-bold text-white bg-blue-500 hover:bg-blue-600 active:scale-[0.98] transition-all"
                >
                  신청하기
                </button>
              </>
            )}

            {applyStep === "amount" && (() => {
              const amt = parseInt(applyAmount.replace(/,/g, ""), 10) || 0;
              const belowMin = !!selectedProduct.minAmount && amt < selectedProduct.minAmount;
              const mainBalance = parseInt(accounts[0].balance.replace(/,/g, ""), 10) || 0;
              const exceedsBalance = amt > mainBalance;
              return (
                <>
                  <p className="text-[18px] font-bold text-gray-900">{selectedProduct.title} 가입</p>
                  <p className="text-[13px] text-gray-400 mt-1">
                    {selectedProduct.kind === "deposit" ? "예치할 금액을 입력하세요" : "첫 회차 납입 금액을 입력하세요"}
                  </p>
                  <div className="mt-6 mb-1">
                    <input
                      autoFocus
                      type="text"
                      inputMode="numeric"
                      value={applyAmount}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "");
                        setApplyAmount(digits ? parseInt(digits, 10).toLocaleString("ko-KR") : "");
                      }}
                      placeholder="0"
                      className="w-full text-right text-[28px] font-black text-gray-900 outline-none border-b-2 border-gray-100 focus:border-blue-400 pb-2 transition-colors"
                    />
                    <p className="text-right text-[13px] text-gray-400 mt-1">원</p>
                  </div>
                  {selectedProduct.minAmount && (
                    <p className={`text-[11px] text-center mb-4 ${belowMin && applyAmount ? "text-red-500" : "text-gray-400"}`}>
                      최소 {selectedProduct.minAmount.toLocaleString()}원부터 가입 가능해요
                    </p>
                  )}
                  {exceedsBalance && applyAmount && (
                    <p className="text-[11px] text-center mb-4 text-red-500">
                      입출금 계좌 잔액({mainBalance.toLocaleString()}원)을 넘을 수 없어요
                    </p>
                  )}
                  <p className="text-[12px] text-gray-400 text-center mb-4">가입 즉시 입출금 계좌에서 이체돼요</p>
                  <button
                    onClick={() => { onSubscribe(amt, selectedProduct.title); setApplyStep("done"); }}
                    disabled={!applyAmount || belowMin || exceedsBalance}
                    className="w-full py-4 rounded-xl text-[16px] font-bold text-white bg-blue-500 disabled:opacity-40 active:scale-[0.98] transition-all"
                  >
                    가입 확정
                  </button>
                  <button onClick={() => setApplyStep("detail")} className="w-full mt-2 py-2.5 text-[13px] text-gray-400 active:scale-95 transition-transform">
                    이전으로
                  </button>
                </>
              );
            })()}

            {applyStep === "done" && (
              <div className="flex flex-col items-center gap-4 py-2 text-center">
                <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8"><path d="M20 6L9 17l-5-5" /></svg>
                </div>
                <div>
                  <p className="text-[13px] text-green-600 font-semibold mb-1">
                    {selectedProduct.kind === "loan" ? "신청 접수 완료" : "가입 완료"}
                  </p>
                  <p className="text-[20px] font-bold text-gray-900">{selectedProduct.title}</p>
                  <p className="text-[13px] text-gray-400 mt-1">
                    {selectedProduct.kind === "loan"
                      ? "심사 후 결과를 알려드릴게요"
                      : `${(parseInt(applyAmount.replace(/,/g, ""), 10) || 0).toLocaleString()}원이 입출금 계좌에서 이체됐어요`}
                  </p>
                </div>
                <button
                  onClick={() => { setSelectedProduct(null); setApplyStep("detail"); }}
                  className="w-full py-4 rounded-xl text-[16px] font-bold text-white bg-blue-500 hover:bg-blue-600 active:scale-[0.98] transition-all"
                >
                  확인
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
