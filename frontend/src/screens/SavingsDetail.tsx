// 적금·예금 상세 + 중도해지 — 3단계: detail → confirm → done

import { useState } from "react";
import { MY_ACCOUNTS, SAVINGS_INFO } from "../shared/data";
import { BankLogo } from "../shared/ui";

type SavingsStep = "detail" | "confirm" | "done";

const fmt = (n: number) => n.toLocaleString("ko-KR");

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className="h-full bg-[var(--ac-500)] rounded-full transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function SavingsDetail({
  account,
  onBack,
  onTransfer,
  onEarlyClosure,
  isClosed = false,
}: {
  account: typeof MY_ACCOUNTS[number];
  onBack: () => void;
  onTransfer: () => void;
  onEarlyClosure: (amount: number) => void;
  isClosed?: boolean;
}) {
  const [step, setStep] = useState<SavingsStep>("detail");

  const clean = account.account.replace(/\D/g, "");
  const info = SAVINGS_INFO[clean];
  const balance = parseInt(account.balance.replace(/,/g, ""), 10);

  // 납입 진행률 (적금만 해당)
  const now = new Date();
  const start = info ? new Date(info.startDate) : now;
  const end = info ? new Date(info.maturityDate) : now;
  const totalMonths = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30));
  const elapsedMonths = Math.round((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30));

  if (!info) {
    return (
      <div className="flex flex-col gap-4 pb-6">
        <button onClick={onBack} className="flex items-center gap-1 text-gray-400 active:scale-90 transition-transform w-fit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <p className="text-center text-gray-400 text-[14px] mt-10">상세 정보를 불러올 수 없어요</p>
      </div>
    );
  }

  // ── 상세 화면 ────────────────────────────────────────────────────────────────
  if (step === "detail") {
    return (
      <div className="flex flex-col gap-4 pb-6">
        <button onClick={onBack} className="flex items-center gap-1 text-gray-400 active:scale-90 transition-transform w-fit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M15 18l-6-6 6-6" /></svg>
          <span className="text-[14px] text-gray-500">뒤로</span>
        </button>

        {/* 계좌 요약 */}
        <div className="bg-gradient-to-br from-[var(--ac-hero-from)] via-[var(--ac-hero-via)] to-[var(--ac-hero-to)] rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <BankLogo bank={account.bank} size={28} />
            <div>
              <p className="text-white/70 text-[12px]">{account.bank}</p>
              <p className="text-white text-[15px] font-bold">{account.name}</p>
            </div>
          </div>
          <p className="text-white/70 text-[12px]">현재 잔액</p>
          <p className="text-white text-[32px] font-black">{fmt(balance)}원</p>
          <p className="text-white/60 text-[12px] mt-1">만기 {info.maturityDate} · 연 {info.rate}%</p>
        </div>

        {/* 상품 정보 */}
        <div className="bg-white rounded-2xl p-5 flex flex-col gap-4">
          <p className="text-[14px] font-bold text-gray-900">상품 정보</p>
          <div className="flex flex-col gap-3 text-[13px]">
            {[
              ["상품 유형", info.type],
              ["적용 금리", `연 ${info.rate}%`],
              ["가입 기간", `${info.startDate} ~ ${info.maturityDate}`],
              ...(info.monthlyAmt ? [["월 납입액", `${fmt(info.monthlyAmt)}원`]] : []),
              ["현재 이자", `+${fmt(info.earnedInterest)}원`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-gray-400">{k}</span>
                <span className="font-semibold text-gray-900">{v}</span>
              </div>
            ))}
          </div>

          {/* 납입 진행률 (적금만) */}
          {info.monthlyAmt && (
            <div className="pt-3 border-t border-gray-50">
              <div className="flex justify-between text-[12px] text-gray-500 mb-2">
                <span>납입 현황</span>
                <span className="font-semibold text-[var(--ac-500)]">{elapsedMonths} / {totalMonths}개월</span>
              </div>
              <ProgressBar value={elapsedMonths} max={totalMonths} />
            </div>
          )}

          {/* 예상 만기 수령액 */}
          <div className="bg-[var(--ac-50)] rounded-xl p-4 flex justify-between items-center">
            <div>
              <p className="text-[11px] text-[var(--ac-400)]">만기 수령 예정액</p>
              <p className="text-[18px] font-black text-[var(--ac-600)]">{fmt(balance + info.earnedInterest)}원</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-gray-400">남은 기간</p>
              <p className="text-[14px] font-bold text-gray-600">{totalMonths - elapsedMonths}개월</p>
            </div>
          </div>
        </div>

        {/* 중도해지 버튼 */}
        {isClosed ? (
          <div className="w-full py-3.5 rounded-xl text-[15px] font-bold text-gray-400 border-2 border-gray-200 bg-gray-50 text-center">
            해지 완료된 계좌입니다
          </div>
        ) : (
          <>
            <button
              onClick={() => setStep("confirm")}
              className="w-full py-3.5 rounded-xl text-[15px] font-bold text-red-600 border-2 border-red-200 bg-red-50 active:scale-[0.98] transition-all"
            >
              중도해지 신청
            </button>
            <p className="text-[11px] text-gray-400 text-center -mt-2">
              ⚠ 중도해지 시 이자 손실이 발생할 수 있어요
            </p>
          </>
        )}
      </div>
    );
  }

  // ── 해지 확인 화면 ───────────────────────────────────────────────────────────
  if (step === "confirm") {
    const lossAmt = info.earnedInterest - info.penaltyAmount;
    return (
      <div className="flex flex-col gap-4 pb-6">
        <button onClick={() => setStep("detail")} className="flex items-center gap-1 text-gray-400 active:scale-90 transition-transform w-fit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M15 18l-6-6 6-6" /></svg>
          <span className="text-[14px] text-gray-500">취소</span>
        </button>

        {/* 경고 헤더 */}
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[20px]">⚠️</span>
            <p className="text-[16px] font-bold text-red-700">중도해지 안내</p>
          </div>
          <p className="text-[13px] text-red-600 leading-relaxed">
            만기 전 해지 시 약정 금리({info.rate}%) 대신<br />
            중도해지 금리({info.penaltyRate}%)가 적용돼요.
          </p>
        </div>

        {/* 수령액 계산 */}
        <div className="bg-white rounded-2xl p-5 flex flex-col gap-3">
          <p className="text-[14px] font-bold text-gray-900">예상 해지 수령액</p>
          <div className="flex flex-col gap-2 text-[13px]">
            {[
              ["원금",               `${fmt(info.totalDeposited)}원`,  "text-gray-700"],
              ["중도해지 이자",      `+${fmt(info.penaltyAmount)}원`,  "text-gray-700"],
            ].map(([k, v, cls]) => (
              <div key={k} className="flex justify-between">
                <span className="text-gray-400">{k}</span>
                <span className={`font-semibold ${cls}`}>{v}</span>
              </div>
            ))}
          </div>
          <div className="h-px bg-gray-100" />
          <div className="flex justify-between">
            <span className="text-[14px] font-bold text-gray-900">실수령액</span>
            <span className="text-[18px] font-black text-[var(--ac-600)]">{fmt(info.afterPenaltyBalance)}원</span>
          </div>
          <div className="bg-red-50 rounded-xl px-4 py-2 flex justify-between items-center">
            <span className="text-[12px] text-red-500">만기 대비 손실</span>
            <span className="text-[13px] font-bold text-red-600">-{fmt(lossAmt)}원</span>
          </div>
        </div>

        <p className="text-[12px] text-gray-400 text-center leading-relaxed">
          해지 금액은 <strong>{info.mainAccountName}</strong>으로 즉시 이체돼요.
        </p>

        <button
          onClick={() => { onEarlyClosure(info.afterPenaltyBalance); setStep("done"); }}
          className="w-full py-4 rounded-xl text-[16px] font-bold text-white bg-red-500 active:scale-[0.98] transition-all"
        >
          해지 확인
        </button>
      </div>
    );
  }

  // ── 해지 완료 화면 ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 pb-6 items-center">
      <div className="w-full flex flex-col items-center gap-5 bg-white rounded-2xl p-8">
        <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-[13px] text-green-600 font-semibold mb-1">중도해지 완료</p>
          <p className="text-[28px] font-black text-gray-900">{fmt(info.afterPenaltyBalance)}원</p>
          <p className="text-[13px] text-gray-400 mt-1">
            {info.mainAccountName}으로 이체됐어요
          </p>
        </div>
        <div className="w-full bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-2">
          <span className="text-[16px]">⚠️</span>
          <p className="text-[12px] text-amber-700 leading-relaxed">
            큰 금액이 입출금 통장에 있어요.<br />
            지금 누군가 이 돈을 이체하라고 한다면 <strong>보이스피싱</strong>일 수 있어요.
          </p>
        </div>
      </div>

      <button
        onClick={onTransfer}
        className="w-full py-4 rounded-xl text-[15px] font-bold text-white bg-[var(--ac-500)] active:scale-[0.98] transition-all"
      >
        이체하기
      </button>
      <button
        onClick={onBack}
        className="w-full py-3 rounded-xl text-[14px] font-medium text-gray-500 border border-gray-200 bg-white active:scale-[0.98] transition-all"
      >
        홈으로
      </button>
    </div>
  );
}
