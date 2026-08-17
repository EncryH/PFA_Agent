// 부모 앱 홈 — 계좌 목록, 안심동행 배너, 현황, 금융상품

import { useEffect, useState } from "react";
import { MY_ACCOUNTS } from "../shared/data";
import { BankLogo } from "../shared/ui";
import { PROTECTION_LEVELS, useProtectionLevel } from "../shared/protection";

const PRODUCTS = [
  { title: "안심 정기예금",     desc: "연 3.5% · 12개월" },
  { title: "내일채움 적금",     desc: "월 30만원부터" },
  { title: "안심 신용대출",     desc: "최저 연 4.2%" },
  { title: "주택청약종합저축",  desc: "비과세 · 소득공제" },
];

function AnsimBanner({ paired, onClick }: { paired: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} className="mt-3 rounded-2xl p-6 bg-gradient-to-br from-blue-700 via-blue-500 to-cyan-400 flex items-center justify-between active:scale-[0.98] hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer">
      <div>
        <p className="text-[14px] font-semibold text-white mb-1">안심동행 AI</p>
        <p className="text-[20px] text-white leading-snug">부모님 금융을<br />가족이 함께 지켜요</p>
        <p className="text-[12px] text-white mt-2">{paired ? "연결 상태 보기" : "시작하기"} &gt;</p>
      </div>
      <svg viewBox="0 0 48 48" fill="white" fillOpacity="0.9" className="w-28 h-28"><circle cx="14" cy="12" r="4.5" /><path d="M14 17c-4 0-7 3-7 7v6h14v-6c0-4-3-7-7-7z" /><circle cx="34" cy="12" r="4.5" /><path d="M34 17c-4 0-7 3-7 7v6h14v-6c0-4-3-7-7-7z" /><circle cx="24" cy="20" r="3.5" /><path d="M24 24c-3 0-5.5 2.5-5.5 5.5V36h11v-6.5c0-3-2.5-5.5-5.5-5.5z" /></svg>
    </div>
  );
}

export default function ParentHome({
  onTransfer, onGuardian, onAccount, largeText,
}: {
  onTransfer: () => void;
  onGuardian: () => void;
  onAccount: (i: number) => void;
  largeText: boolean;
}) {
  const [paired, setPaired] = useState(() => localStorage.getItem("ansimPaired") === "true");
  const [protectionLevel] = useProtectionLevel();
  const protection = PROTECTION_LEVELS[protectionLevel];

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
    const mainAccount = MY_ACCOUNTS[0];

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
            <button onClick={onTransfer} className="min-h-16 rounded-2xl bg-blue-600 text-[18px] font-bold text-white active:scale-[0.98] transition-transform">송금하기</button>
          </div>
        </section>

        <AnsimBanner paired={paired} onClick={onGuardian} />

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

      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl p-5 flex flex-col gap-4 hover:shadow-lg transition-all duration-200">
        {MY_ACCOUNTS.map((acc, i) => (
          <div key={acc.name} className="group flex items-center justify-between rounded-xl -mx-2 px-2 -my-2 py-2 hover:bg-blue-50/50 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
            {/* 계좌를 누르면 거래내역으로 */}
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
        <button className="text-[13px] text-gray-400 text-center pt-2 border-t border-gray-100">모두보기</button>
      </div>

      <div className="bg-white rounded-2xl p-5 mt-3 flex items-center justify-between hover:shadow-lg hover:-translate-y-0.5 transition-all">
        <div>
          <p className="text-[18px] font-bold text-gray-900">0원</p>
          <p className="text-[13px] text-gray-400">9월 이용 금액</p>
        </div>
        <button className="text-[13px] text-gray-500 bg-gray-100 rounded-md px-4 py-1.5 font-medium">내역</button>
      </div>

      <AnsimBanner paired={paired} onClick={onGuardian} />

      {paired && (
        <button onClick={onGuardian} className="w-full mt-3 bg-white rounded-2xl p-4 flex items-center gap-3 text-left hover:shadow-md active:scale-[0.98] transition-all">
          <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-[15px] font-bold text-green-700">지</div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[14px] font-bold text-gray-900">딸 지혜와 연결됨</p>
              <span className="w-2 h-2 rounded-full bg-green-500" />
            </div>
            <p className="text-[12px] text-gray-400 mt-0.5">Lv.{protectionLevel} {protection.name} · 현재 보호 중</p>
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
            <button key={p.title} className="bg-blue-50/60 rounded-xl p-4 text-left active:scale-95 hover:bg-blue-100/60 hover:-translate-y-0.5 hover:shadow-md transition-all">
              <p className="text-[14px] font-semibold text-gray-900">{p.title}</p>
              <p className="text-[12px] text-gray-400 mt-1">{p.desc}</p>
            </button>
          ))}
        </div>
      </div>

    </>
  );
}
