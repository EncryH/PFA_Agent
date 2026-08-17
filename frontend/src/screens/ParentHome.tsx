// 부모 앱 홈 — 계좌 목록, 안심동행 배너, 현황, 금융상품

import { useEffect, useState } from "react";
import { MY_ACCOUNTS } from "../shared/data";
import { BankLogo } from "../shared/ui";

const PRODUCTS = [
  { title: "안심 정기예금",    desc: "연 3.5% · 12개월" },
  { title: "내일채움 적금",    desc: "월 30만원부터" },
  { title: "안심 신용대출",    desc: "최저 연 4.2%" },
  { title: "주택청약종합저축", desc: "비과세 · 소득공제" },
];

type ProductDetail = {
  title: string;
  desc: string;
  details: { label: string; value: string }[];
  tagline: string;
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
  },
};

const SPENDING_BREAKDOWN = [
  { label: "이체",     amount: 650_000 },
  { label: "자동이체", amount: 184_000 },
  { label: "체크카드", amount: 51_000 },
];
const SPENDING_TOTAL = SPENDING_BREAKDOWN.reduce((s, x) => s + x.amount, 0);

export default function ParentHome({
  onTransfer, onGuardian, onAccount, onVerify,
  onAllAccounts, onMonthlyDetail, accounts = MY_ACCOUNTS,
}: {
  onTransfer: () => void;
  onGuardian: () => void;
  onAccount: (i: number) => void;
  onVerify: () => void;
  onAllAccounts?: () => void;
  onMonthlyDetail?: () => void;
  accounts?: typeof MY_ACCOUNTS;
}) {
  const [paired, setPaired] = useState(() => localStorage.getItem("ansimPaired") === "true");
  const [spendingOpen, setSpendingOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductDetail | null>(null);

  useEffect(() => {
    const syncPairing = () => setPaired(localStorage.getItem("ansimPaired") === "true");
    window.addEventListener("ansim-paired", syncPairing);
    window.addEventListener("storage", syncPairing);
    return () => {
      window.removeEventListener("ansim-paired", syncPairing);
      window.removeEventListener("storage", syncPairing);
    };
  }, []);

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
            <button onClick={onTransfer} className="shrink-0 ml-2 text-[13px] text-gray-900 bg-blue-50 rounded-md px-4 py-1.5 font-medium active:scale-95 hover:bg-blue-100 transition-all">
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

      <div className="bg-white rounded-2xl p-5 mt-3 flex items-center justify-between hover:shadow-lg hover:-translate-y-0.5 transition-all">
        <div>
          <p className="text-[18px] font-bold text-gray-900">{SPENDING_TOTAL.toLocaleString()}원</p>
          <p className="text-[13px] text-gray-400">9월 이용 금액</p>
        </div>
        <button
          onClick={() => { onMonthlyDetail?.(); setSpendingOpen(true); }}
          className="text-[13px] text-gray-500 bg-gray-100 rounded-md px-4 py-1.5 font-medium active:scale-95 hover:bg-gray-200 transition-all"
        >
          내역
        </button>
      </div>

      <div onClick={onGuardian} className="mt-3 rounded-2xl p-6 bg-gradient-to-br from-blue-700 via-blue-500 to-cyan-400 flex items-center justify-between active:scale-[0.98] hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer">
        <div>
          <p className="text-[14px] font-semibold text-white mb-1">안심동행 AI</p>
          <p className="text-[20px] text-white leading-snug">부모님 금융을<br />가족이 함께 지켜요</p>
          <p className="text-[12px] text-white mt-2">{paired ? "연결 상태 보기" : "시작하기"} &gt;</p>
        </div>
        <svg viewBox="0 0 48 48" fill="white" fillOpacity="0.9" className="w-28 h-28"><circle cx="14" cy="12" r="4.5" /><path d="M14 17c-4 0-7 3-7 7v6h14v-6c0-4-3-7-7-7z" /><circle cx="34" cy="12" r="4.5" /><path d="M34 17c-4 0-7 3-7 7v6h14v-6c0-4-3-7-7-7z" /><circle cx="24" cy="20" r="3.5" /><path d="M24 24c-3 0-5.5 2.5-5.5 5.5V36h11v-6.5c0-3-2.5-5.5-5.5-5.5z" /></svg>
      </div>

      {/* 상대방 검증 버튼 */}
      <button onClick={onVerify} className="w-full mt-3 bg-white rounded-2xl p-4 flex items-center gap-4 text-left hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all">
        <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
            <path d="M11 8v3m0 3h.01" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-[14px] font-bold text-gray-900">상대방 검증</p>
          <p className="text-[12px] text-gray-400 mt-0.5">번호·링크·기관명 안전 여부 확인</p>
        </div>
        <span className="text-[12px] font-semibold text-orange-500">검증하기</span>
      </button>

      {paired && (
        <button onClick={onGuardian} className="w-full mt-3 bg-white rounded-2xl p-4 flex items-center gap-3 text-left hover:shadow-md active:scale-[0.98] transition-all">
          <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-[15px] font-bold text-green-700">지</div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[14px] font-bold text-gray-900">딸 지혜와 연결됨</p>
              <span className="w-2 h-2 rounded-full bg-green-500" />
            </div>
            <p className="text-[12px] text-gray-400 mt-0.5">Lv.2 공동확인 · 현재 보호 중</p>
          </div>
          <span className="text-[12px] font-semibold text-blue-600">자세히</span>
        </button>
      )}

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

      <div className="mt-3 bg-white rounded-2xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all">
        <p className="text-[16px] font-bold text-gray-900 mb-4">금융상품</p>
        <div className="grid grid-cols-2 gap-3">
          {PRODUCTS.map((p) => (
            <button
              key={p.title}
              onClick={() => setSelectedProduct(PRODUCT_DETAILS[p.title] ?? null)}
              className="bg-blue-50/60 rounded-xl p-4 text-left active:scale-95 hover:bg-blue-100/60 hover:-translate-y-0.5 hover:shadow-md transition-all"
            >
              <p className="text-[14px] font-semibold text-gray-900">{p.title}</p>
              <p className="text-[12px] text-gray-400 mt-1">{p.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ─── 월별 지출 바텀시트 ───────────────────────────────────────────── */}
      {spendingOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            style={{ animation: "fade-in 180ms ease-out both" }}
            onClick={() => setSpendingOpen(false)}
          />
          <div
            className="absolute bottom-0 bg-white rounded-t-3xl px-5 pt-5 pb-8"
            style={{ left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, animation: "sheet-up 240ms cubic-bezier(.2,.8,.2,1) both" }}
          >
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5" />
            <p className="text-[18px] font-bold text-gray-900 mb-1">9월 이용 금액</p>
            <p className="text-[28px] font-bold text-gray-900 mb-5">{SPENDING_TOTAL.toLocaleString()}원</p>
            <div className="flex flex-col gap-3">
              {SPENDING_BREAKDOWN.map((item) => (
                <div key={item.label} className="flex items-center justify-between py-3 border-b border-gray-100">
                  <span className="text-[15px] text-gray-700">{item.label}</span>
                  <span className="text-[15px] font-semibold text-gray-900">{item.amount.toLocaleString()}원</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setSpendingOpen(false)}
              className="w-full mt-6 py-4 rounded-xl text-[16px] font-bold text-white bg-blue-500 hover:bg-blue-600 active:scale-[0.98] transition-all"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* ─── 금융상품 상세 바텀시트 ──────────────────────────────────────── */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            style={{ animation: "fade-in 180ms ease-out both" }}
            onClick={() => setSelectedProduct(null)}
          />
          <div
            className="absolute bottom-0 bg-white rounded-t-3xl px-5 pt-5 pb-8"
            style={{ left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, animation: "sheet-up 240ms cubic-bezier(.2,.8,.2,1) both" }}
          >
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5" />
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
              onClick={() => setSelectedProduct(null)}
              className="w-full py-4 rounded-xl text-[16px] font-bold text-white bg-blue-500 hover:bg-blue-600 active:scale-[0.98] transition-all"
            >
              신청하기
            </button>
          </div>
        </div>
      )}
    </>
  );
}
