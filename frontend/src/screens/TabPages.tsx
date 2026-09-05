// 하단 탭바 — 금융 / 상품 / 혜택 / 주식 탭 화면 모음.
// 각 탭은 App.tsx 에서 page === "home" && tab === "X" 조건으로 렌더링된다.

import { useEffect, useState } from "react";
import { MY_ACCOUNTS, SAVINGS_INFO, parseAmt } from "../shared/data";
import { BankLogo } from "../shared/ui";
import { usePoints } from "../shared/points";
import { applyForLoan } from "../shared/loanApplications";

const fmt = (n: number) => n.toLocaleString("ko-KR");

// ═══════════════════════════════════════════════════════════════════════════════
// 1. FinancialTab — 자산 현황, 계좌별 바 차트, 월별 지출
// ═══════════════════════════════════════════════════════════════════════════════
export function FinancialTab({ onAccount, accounts = MY_ACCOUNTS }: { onAccount: (i: number) => void; accounts?: typeof MY_ACCOUNTS }) {
  const balances = accounts.map((a) => parseAmt(a.balance));
  const total = balances.reduce((s, b) => s + b, 0);
  const maxBalance = Math.max(...balances);

  const SPENDING = [
    { label: "이체",     amount: 650_000 },
    { label: "자동이체", amount: 184_000 },
    { label: "체크카드", amount: 51_000 },
  ];
  const totalSpend = SPENDING.reduce((s, x) => s + x.amount, 0);

  return (
    <div className="flex flex-col gap-3">
      {/* 총 자산 */}
      <div className="bg-white rounded-2xl p-5 hover:shadow-lg transition-all">
        <p className="text-[13px] text-gray-400">총 자산</p>
        <p className="text-[30px] font-bold text-gray-900 mt-1 tracking-tight">{fmt(total)}원</p>
        <p className="text-[12px] text-gray-400 mt-0.5">{accounts.length}개 계좌</p>
      </div>

      {/* 계좌별 자산 바 차트 */}
      <div className="bg-white rounded-2xl p-5 hover:shadow-lg transition-all">
        <p className="text-[14px] font-bold text-gray-900 mb-4">계좌별 자산</p>
        <div className="flex flex-col gap-4">
          {accounts.map((acc, i) => {
            const bal = balances[i];
            const pct = maxBalance > 0 ? (bal / maxBalance) * 100 : 0;
            return (
              <button
                key={acc.account}
                onClick={() => onAccount(i)}
                className="text-left active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <BankLogo bank={acc.bank} size={22} />
                    <span className="text-[13px] text-gray-600 truncate max-w-[160px]">{acc.name}</span>
                  </div>
                  <span className="text-[13px] font-semibold text-gray-900 shrink-0">{acc.balance}원</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: "var(--ac-500)" }}
                  />
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-[12px] text-gray-400">전체 계좌 비중</span>
          <span className="text-[12px] text-gray-500">
            {accounts.map((a, i) => `${a.bank.replace(/은행|뱅크/, "")} ${Math.round((balances[i] / total) * 100)}%`).join(" · ")}
          </span>
        </div>
      </div>

      {/* 이번 달 지출 */}
      <div className="bg-white rounded-2xl p-5 hover:shadow-lg transition-all">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[14px] font-bold text-gray-900">9월 지출 현황</p>
          <span className="text-[13px] font-bold text-gray-900">{fmt(totalSpend)}원</span>
        </div>
        <div className="flex flex-col gap-3">
          {SPENDING.map((item) => {
            const pct = (item.amount / totalSpend) * 100;
            return (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] text-gray-600">{item.label}</span>
                  <span className="text-[13px] font-semibold text-gray-900">{fmt(item.amount)}원</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: "var(--ac-400)" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. ProductsTab — 가입 상품 + 추천 상품
// ═══════════════════════════════════════════════════════════════════════════════
const SAVINGS_INDICES = [1, 2];

type RecommendDetail = {
  title: string;
  desc: string;
  tag: string;
  details: { label: string; value: string }[];
  tagline: string;
  /** deposit·savings = 신청하면 입출금 계좌에서 즉시 이체돼요. loan = 심사 신청만 접수돼요. */
  kind: "deposit" | "savings" | "loan";
  minAmount?: number;
  maxAmount?: number;
};

const RECOMMEND: RecommendDetail[] = [
  {
    title: "프리미엄 예금", desc: "연 3.8% · 24개월", tag: "금리우대",
    details: [
      { label: "가입기간", value: "24개월" },
      { label: "금리",     value: "연 3.8%" },
      { label: "최소금액", value: "100만원" },
    ],
    tagline: "긴 호흡으로 더 높은 금리를 받아보세요",
    kind: "deposit",
    minAmount: 1_000_000,
  },
  {
    title: "청년 희망 적금", desc: "연 5.0% · 청년전용", tag: "인기",
    details: [
      { label: "가입기간", value: "24개월" },
      { label: "금리",     value: "연 5.0%" },
      { label: "납입금액", value: "월 10만원부터" },
    ],
    tagline: "청년 전용 우대금리로 목돈을 모아보세요",
    kind: "savings",
    minAmount: 100_000,
  },
  {
    title: "중금리 신용대출", desc: "최저 연 5.9%", tag: "신규",
    details: [
      { label: "한도",     value: "최대 2천만원" },
      { label: "금리",     value: "최저 연 5.9%" },
      { label: "상환방식", value: "원리금균등" },
    ],
    tagline: "필요한 만큼만 합리적인 금리로",
    kind: "loan",
    maxAmount: 20_000_000,
  },
  {
    title: "ISA 절세 계좌", desc: "비과세 · 소득공제", tag: "절세",
    details: [
      { label: "세금혜택", value: "비과세" },
      { label: "소득공제", value: "연말정산" },
      { label: "최소납입", value: "월 10만원부터" },
    ],
    tagline: "절세 효과까지 챙기는 자산 관리",
    kind: "savings",
    minAmount: 100_000,
  },
];

export function ProductsTab({
  onSavings, showOwned = true, role = "parent", onSubscribe,
}: {
  onSavings?: (i: number) => void;
  showOwned?: boolean;
  role?: string;
  /** 예금·적금 가입 확정 시 입출금 계좌에서 실제로 돈을 빼는 건 화면(App)이 담당한다. */
  onSubscribe?: (amount: number, productTitle: string) => void;
}) {
  const [selected, setSelected] = useState<RecommendDetail | null>(null);
  const [applyStep, setApplyStep] = useState<"detail" | "amount" | "done">("detail");
  const [applyAmount, setApplyAmount] = useState("");
  const mainBalance = parseAmt(MY_ACCOUNTS[0].balance);

  const openProduct = (p: RecommendDetail) => {
    setSelected(p);
    setApplyStep("detail");
    setApplyAmount(p.minAmount ? p.minAmount.toLocaleString("ko-KR") : "");
  };

  return (
    <div className="flex flex-col gap-3">
      {showOwned && (
      <div className="bg-white rounded-2xl p-5 hover:shadow-lg transition-all">
        <p className="text-[14px] font-bold text-gray-900 mb-3">내 상품</p>
        <div className="flex flex-col gap-3">
          {SAVINGS_INDICES.map((idx) => {
            const acc = MY_ACCOUNTS[idx];
            const info = SAVINGS_INFO[acc.account];
            return (
              <button
                key={acc.account}
                onClick={() => onSavings?.(idx)}
                className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3.5 text-left hover:bg-blue-50/60 active:scale-[0.98] transition-all"
              >
                <div className="flex items-center gap-3">
                  <BankLogo bank={acc.bank} size={34} />
                  <div>
                    <p className="text-[14px] font-semibold text-gray-900">{acc.name}</p>
                    <p className="text-[12px] text-gray-400 mt-0.5">
                      {info ? `연 ${info.rate}% · 만기 ${info.maturityDate}` : acc.bank}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[14px] font-bold text-gray-900">{acc.balance}원</p>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4 text-gray-300 ml-auto mt-1"><path d="M9 6l6 6-6 6" /></svg>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      )}

      <div className="bg-white rounded-2xl p-5 hover:shadow-lg transition-all">
        <p className="text-[14px] font-bold text-gray-900 mb-3">추천 상품</p>
        <div className="grid grid-cols-2 gap-3">
          {RECOMMEND.map((p) => (
            <button
              key={p.title}
              type="button"
              onClick={() => openProduct(p)}
              className="rounded-xl bg-blue-50/60 p-4 text-left cursor-pointer hover:bg-blue-100/60 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] transition-all"
            >
              <span
                className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-md mb-2 text-white"
                style={{ background: "var(--ac-500)" }}
              >
                {p.tag}
              </span>
              <p className="text-[13px] font-semibold text-gray-900">{p.title}</p>
              <p className="text-[11px] text-gray-400 mt-1">{p.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ─── 추천 상품 상세 바텀시트 (상세 → 금액 입력 → 완료) ────────────── */}
      {selected && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            style={{ animation: "fade-in 180ms ease-out both" }}
            onClick={() => { setSelected(null); setApplyStep("detail"); }}
          />
          <div
            className="absolute bottom-0 left-0 right-0 mx-auto w-full bg-white rounded-t-3xl px-5 pt-5 pb-8"
            style={{ maxWidth: 430, animation: "sheet-up 240ms cubic-bezier(.2,.8,.2,1) both" }}
          >
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5" />

            {applyStep === "detail" && (
              <>
                <p className="text-[20px] font-bold text-gray-900">{selected.title}</p>
                <p className="text-[13px] text-gray-400 mt-1">{selected.desc}</p>
                <p className="text-[14px] text-blue-600 font-semibold mt-3 mb-4">{selected.tagline}</p>
                <div className="flex flex-col gap-3 bg-gray-50 rounded-2xl p-4 mb-5">
                  {selected.details.map((d) => (
                    <div key={d.label} className="flex items-center justify-between">
                      <span className="text-[13px] text-gray-500">{d.label}</span>
                      <span className="text-[13px] font-semibold text-gray-900">{d.value}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setApplyStep("amount")}
                  className="w-full py-4 rounded-xl text-[16px] font-bold text-white active:scale-[0.98] transition-all"
                  style={{ background: "var(--ac-500)" }}
                >
                  신청하기
                </button>
              </>
            )}

            {applyStep === "amount" && (() => {
              const amt = parseInt(applyAmount.replace(/,/g, ""), 10) || 0;
              const belowMin = !!selected.minAmount && amt < selected.minAmount;
              const exceedsBalance = selected.kind !== "loan" && amt > mainBalance;
              const exceedsMax = selected.kind === "loan" && !!selected.maxAmount && amt > selected.maxAmount;
              return (
                <>
                  <p className="text-[18px] font-bold text-gray-900">{selected.title} {selected.kind === "loan" ? "신청" : "가입"}</p>
                  <p className="text-[13px] text-gray-400 mt-1">
                    {selected.kind === "deposit" ? "예치할 금액을 입력하세요"
                      : selected.kind === "loan" ? "대출 희망 금액을 입력하세요"
                      : "첫 회차 납입 금액을 입력하세요"}
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
                  {selected.minAmount && (
                    <p className={`text-[11px] text-center mb-4 ${belowMin && applyAmount ? "text-red-500" : "text-gray-400"}`}>
                      최소 {selected.minAmount.toLocaleString()}원부터 {selected.kind === "loan" ? "신청" : "가입"} 가능해요
                    </p>
                  )}
                  {exceedsBalance && applyAmount && (
                    <p className="text-[11px] text-center mb-4 text-red-500">
                      입출금 계좌 잔액({mainBalance.toLocaleString()}원)을 넘을 수 없어요
                    </p>
                  )}
                  {exceedsMax && applyAmount && (
                    <p className="text-[11px] text-center mb-4 text-red-500">
                      대출 한도({selected.maxAmount!.toLocaleString()}원)를 넘을 수 없어요
                    </p>
                  )}
                  <p className="text-[12px] text-gray-400 text-center mb-4">
                    {selected.kind === "loan" ? "심사 후 대출금이 입출금 계좌로 입금돼요" : "가입 즉시 입출금 계좌에서 이체돼요"}
                  </p>
                  <button
                    onClick={() => {
                      if (selected.kind === "loan") applyForLoan(role, selected.title, amt);
                      else onSubscribe?.(amt, selected.title);
                      setApplyStep("done");
                    }}
                    disabled={!applyAmount || belowMin || exceedsBalance || exceedsMax}
                    className="w-full py-4 rounded-xl text-[16px] font-bold text-white disabled:opacity-40 active:scale-[0.98] transition-all"
                    style={{ background: "var(--ac-500)" }}
                  >
                    {selected.kind === "loan" ? "신청 확정" : "가입 확정"}
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
                    {selected.kind === "loan" ? "신청 접수 완료" : "가입 완료"}
                  </p>
                  <p className="text-[20px] font-bold text-gray-900">{selected.title}</p>
                  <p className="text-[13px] text-gray-400 mt-1">
                    {selected.kind === "loan"
                      ? "심사 후 결과를 알려드릴게요"
                      : `${(parseInt(applyAmount.replace(/,/g, ""), 10) || 0).toLocaleString()}원이 입출금 계좌에서 이체됐어요`}
                  </p>
                </div>
                <button
                  onClick={() => { setSelected(null); setApplyStep("detail"); }}
                  className="w-full py-4 rounded-xl text-[16px] font-bold text-white active:scale-[0.98] transition-all"
                  style={{ background: "var(--ac-500)" }}
                >
                  확인
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. BenefitsTab — 포인트, 혜택 목록, 월별 요약
// ═══════════════════════════════════════════════════════════════════════════════
const BENEFITS = [
  { title: "자동이체 우대",     desc: "아파트 관리비 자동이체 등록", savings: "월 2,000원 할인", detail: "관리비·공과금을 자동이체로 등록하면 매달 자동으로 적용돼요. 이미 등록되어 있어 별도로 신청하실 필요는 없어요." },
  { title: "급여이체 우대금리", desc: "입출금통장 급여이체 인정",    savings: "+0.3%p 적용",    detail: "최근 3개월 이상 급여이체 실적이 확인되면 입출금통장 금리에 0.3%p가 추가로 붙어요." },
  { title: "인터넷뱅킹 할인",  desc: "이체 수수료 전액 면제",       savings: "월 최대 5,000원", detail: "인터넷·모바일뱅킹으로 이체하면 타행 이체 수수료가 월 최대 5,000원까지 면제돼요." },
  { title: "시니어 우대",      desc: "60세 이상 고객 대상",         savings: "환전 50% 할인",   detail: "만 60세 이상 고객은 환전 우대율이 50%까지 적용돼요. 창구·모바일 모두 자동으로 반영돼요." },
];

const ACQUIRED_POINTS_THIS_MONTH = 340;
const SAVED_AMOUNT_THIS_MONTH = 7_000;

export function BenefitsTab({
  role = "parent", onRedeem,
}: {
  role?: string;
  /** 포인트 환급 확정 시 입출금 계좌에 실제로 돈을 넣는 건 화면(App)이 담당한다. */
  onRedeem?: (amount: number) => void;
}) {
  const { points, spent, redeem } = usePoints(role);
  const [selectedBenefit, setSelectedBenefit] = useState<(typeof BENEFITS)[number] | null>(null);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemStep, setRedeemStep] = useState<"input" | "done">("input");
  const [redeemInput, setRedeemInput] = useState("");

  const openRedeem = () => {
    setRedeemStep("input");
    setRedeemInput(points > 0 ? points.toLocaleString("ko-KR") : "");
    setRedeemOpen(true);
  };

  const closeRedeem = () => { setRedeemOpen(false); setRedeemStep("input"); };

  const confirmRedeem = () => {
    const amount = parseInt(redeemInput.replace(/,/g, ""), 10) || 0;
    if (!redeem(amount)) return;
    onRedeem?.(amount);
    setRedeemStep("done");
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={openRedeem}
        className="rounded-2xl p-6 flex items-center justify-between hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.99] transition-all text-left"
        style={{ background: "linear-gradient(135deg, var(--ac-600), var(--ac-400))" }}
      >
        <div>
          <p className="text-[13px] text-white/70 mb-1">보유 포인트</p>
          <p className="text-[34px] font-bold text-white tracking-tight">{points.toLocaleString("ko-KR")}P</p>
          <p className="text-[12px] text-white/60 mt-1">현금 {points.toLocaleString("ko-KR")}원 상당 · 눌러서 환급받기</p>
        </div>
        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" fill="white" className="w-8 h-8">
            <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm1 14.5V18h-2v-1.5a3.5 3.5 0 01-3.5-3.5H9a1.5 1.5 0 001.5 1.5h3a1.5 1.5 0 000-3h-3a3.5 3.5 0 010-7V6h2v1.5a3.5 3.5 0 013.5 3.5H15a1.5 1.5 0 00-1.5-1.5h-3a1.5 1.5 0 000 3h3a3.5 3.5 0 010 7z" />
          </svg>
        </div>
      </button>

      <div className="bg-white rounded-2xl p-5 hover:shadow-lg transition-all">
        <p className="text-[14px] font-bold text-gray-900 mb-3">활성 혜택</p>
        <div className="flex flex-col gap-2">
          {BENEFITS.map((b) => (
            <button
              key={b.title}
              type="button"
              onClick={() => setSelectedBenefit(b)}
              className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3 text-left hover:bg-gray-100 active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: "var(--ac-500)" }} />
                <div>
                  <p className="text-[13px] font-semibold text-gray-900">{b.title}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{b.desc}</p>
                </div>
              </div>
              <span className="text-[11px] font-bold shrink-0 ml-2" style={{ color: "var(--ac-600)" }}>
                {b.savings}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 hover:shadow-lg transition-all">
        <p className="text-[14px] font-bold text-gray-900 mb-3">9월 혜택 요약</p>
        <div className="flex justify-around text-center">
          {[
            { label: "획득 포인트", value: `${ACQUIRED_POINTS_THIS_MONTH.toLocaleString("ko-KR")}P` },
            { label: "사용 포인트", value: `${spent.toLocaleString("ko-KR")}P` },
            { label: "절약 금액",   value: `${SAVED_AMOUNT_THIS_MONTH.toLocaleString("ko-KR")}원` },
          ].map((item, i) => (
            <div
              key={item.label}
              className={`${i > 0 ? "border-l border-gray-100 pl-4" : ""} flex-1`}
            >
              <p className="text-[17px] font-bold text-gray-900">{item.value}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ─── 혜택 상세 바텀시트 ─────────────────────────────────────────── */}
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
            <p className="text-[18px] font-bold text-gray-900">{selectedBenefit.title}</p>
            <div className="mt-2 flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
              <span className="text-[13px] text-gray-500">적용 혜택</span>
              <span className="text-[13px] font-bold" style={{ color: "var(--ac-600)" }}>{selectedBenefit.savings}</span>
            </div>
            <p className="text-[13px] text-gray-500 leading-relaxed mt-4">{selectedBenefit.detail}</p>
            <button
              onClick={() => setSelectedBenefit(null)}
              className="w-full mt-6 py-4 rounded-xl text-[16px] font-bold text-white active:scale-[0.98] transition-all"
              style={{ background: "var(--ac-500)" }}
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* ─── 포인트 환급 바텀시트 (입력 → 완료) ─────────────────────────── */}
      {redeemOpen && (() => {
        const amount = parseInt(redeemInput.replace(/,/g, ""), 10) || 0;
        const exceedsPoints = amount > points;
        return (
          <div className="fixed inset-0 z-50">
            <div
              className="absolute inset-0 bg-black/40"
              style={{ animation: "fade-in 180ms ease-out both" }}
              onClick={closeRedeem}
            />
            <div
              className="absolute bottom-0 left-0 right-0 mx-auto w-full bg-white rounded-t-3xl px-5 pt-5 pb-8"
              style={{ maxWidth: 430, animation: "sheet-up 240ms cubic-bezier(.2,.8,.2,1) both" }}
            >
              <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5" />

              {redeemStep === "input" && (
                <>
                  <p className="text-[18px] font-bold text-gray-900">포인트 환급</p>
                  <p className="text-[13px] text-gray-400 mt-1">1P는 1원으로 입출금 계좌에 환급돼요</p>
                  <div className="mt-6 mb-1">
                    <input
                      autoFocus
                      type="text"
                      inputMode="numeric"
                      value={redeemInput}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "");
                        setRedeemInput(digits ? parseInt(digits, 10).toLocaleString("ko-KR") : "");
                      }}
                      placeholder="0"
                      className="w-full text-right text-[28px] font-black text-gray-900 outline-none border-b-2 border-gray-100 focus:border-blue-400 pb-2 transition-colors"
                    />
                    <p className="text-right text-[13px] text-gray-400 mt-1">P</p>
                  </div>
                  <p className={`text-[11px] text-center mb-4 ${exceedsPoints && redeemInput ? "text-red-500" : "text-gray-400"}`}>
                    보유 포인트 {points.toLocaleString("ko-KR")}P까지 환급할 수 있어요
                  </p>
                  <button
                    onClick={confirmRedeem}
                    disabled={!redeemInput || amount <= 0 || exceedsPoints}
                    className="w-full py-4 rounded-xl text-[16px] font-bold text-white disabled:opacity-40 active:scale-[0.98] transition-all"
                    style={{ background: "var(--ac-500)" }}
                  >
                    환급 받기
                  </button>
                </>
              )}

              {redeemStep === "done" && (
                <div className="flex flex-col items-center gap-4 py-2 text-center">
                  <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8"><path d="M20 6L9 17l-5-5" /></svg>
                  </div>
                  <div>
                    <p className="text-[13px] text-green-600 font-semibold mb-1">환급 완료</p>
                    <p className="text-[20px] font-bold text-gray-900">{amount.toLocaleString("ko-KR")}원</p>
                    <p className="text-[13px] text-gray-400 mt-1">입출금 계좌로 입금됐어요</p>
                  </div>
                  <button
                    onClick={closeRedeem}
                    className="w-full py-4 rounded-xl text-[16px] font-bold text-white active:scale-[0.98] transition-all"
                    style={{ background: "var(--ac-500)" }}
                  >
                    확인
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. StocksTab — 주가 지수, 빈 포트폴리오, 관심 종목
// ═══════════════════════════════════════════════════════════════════════════════
// 종목별 야후 파이낸스 심볼 + 시세 API가 실패했을 때 보여줄 기준값(대략 전날 종가 수준).
const INDICES = [
  { label: "KOSPI",   symbol: "^KS11", decimals: 2, fallbackValue: "2,641.42", fallbackChange: "+0.73%", fallbackUp: true  },
  { label: "KOSDAQ",  symbol: "^KQ11", decimals: 2, fallbackValue: "762.18",   fallbackChange: "-0.14%", fallbackUp: false },
  { label: "USD/KRW", symbol: "KRW=X", decimals: 2, fallbackValue: "1,327.50", fallbackChange: "+0.22%", fallbackUp: true  },
];

const WATCHLIST = [
  { name: "삼성전자",   symbol: "005930.KS", code: "005930", fallbackPrice: "71,200",  fallbackChange: "+1.28%", fallbackUp: true  },
  { name: "SK하이닉스", symbol: "000660.KS", code: "000660", fallbackPrice: "182,500", fallbackChange: "+2.11%", fallbackUp: true  },
  { name: "NAVER",      symbol: "035420.KS", code: "035420", fallbackPrice: "194,000", fallbackChange: "-0.51%", fallbackUp: false },
  { name: "카카오",     symbol: "035720.KS", code: "035720", fallbackPrice: "44,350",  fallbackChange: "-1.34%", fallbackUp: false },
];

// "종목 찾기"에서 검색할 수 있는 전체 종목 풀 — 관심 종목 4개 포함.
const STOCK_UNIVERSE = [
  { name: "삼성전자",         code: "005930", symbol: "005930.KS" },
  { name: "SK하이닉스",       code: "000660", symbol: "000660.KS" },
  { name: "NAVER",           code: "035420", symbol: "035420.KS" },
  { name: "카카오",           code: "035720", symbol: "035720.KS" },
  { name: "LG에너지솔루션",   code: "373220", symbol: "373220.KS" },
  { name: "삼성바이오로직스", code: "207940", symbol: "207940.KS" },
  { name: "현대차",           code: "005380", symbol: "005380.KS" },
  { name: "기아",             code: "000270", symbol: "000270.KS" },
  { name: "POSCO홀딩스",      code: "005490", symbol: "005490.KS" },
  { name: "LG화학",           code: "051910", symbol: "051910.KS" },
  { name: "셀트리온",         code: "068270", symbol: "068270.KS" },
  { name: "KB금융",           code: "105560", symbol: "105560.KS" },
  { name: "신한지주",         code: "055550", symbol: "055550.KS" },
  { name: "삼성SDI",          code: "006400", symbol: "006400.KS" },
  { name: "카카오뱅크",       code: "323410", symbol: "323410.KS" },
  { name: "에코프로",         code: "086520", symbol: "086520.KQ" },
];

const STOCK_SYMBOLS = [...INDICES.map((i) => i.symbol), ...STOCK_UNIVERSE.map((s) => s.symbol)];
const QUOTE_POLL_MS = 20_000;

// 보유 종목 — 부모·자녀는 서로 다른 사람이므로 포트폴리오도 역할별로 분리해 저장한다.
type Holding = { symbol: string; name: string; code: string; qty: number; avgPrice: number };
const portfolioKey = (role: string) => `ansimPortfolio_${role}`;

const loadPortfolio = (role: string): Holding[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(portfolioKey(role)) ?? "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
};

type Quote = { symbol: string; ok: boolean; price?: number; changePct?: number };

function useStockQuotes() {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [status, setStatus] = useState<"loading" | "live" | "offline">("loading");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchQuotes = async () => {
      try {
        const res = await fetch(`/api/stocks?symbols=${STOCK_SYMBOLS.map(encodeURIComponent).join(",")}`);
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (cancelled) return;
        const map: Record<string, Quote> = {};
        for (const q of data.quotes ?? []) map[q.symbol] = q;
        setQuotes(map);
        setStatus("live");
        setUpdatedAt(data.fetchedAt ?? Date.now());
      } catch {
        if (!cancelled) setStatus((s) => (s === "live" ? s : "offline"));
      }
    };

    fetchQuotes();
    const id = setInterval(fetchQuotes, QUOTE_POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return { quotes, status, updatedAt };
}

const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

export function StocksTab({ role = "parent" }: { role?: "parent" | "child" }) {
  const { quotes, status, updatedAt } = useStockQuotes();
  const [portfolio, setPortfolio] = useState<Holding[]>(() => loadPortfolio(role));
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [justAdded, setJustAdded] = useState<string | null>(null);

  useEffect(() => { localStorage.setItem(portfolioKey(role), JSON.stringify(portfolio)); }, [role, portfolio]);

  const priceOf = (symbol: string, fallback: number) => {
    const q = quotes[symbol];
    return q?.ok && q.price != null ? q.price : fallback;
  };

  const addToPortfolio = (stock: { name: string; code: string; symbol: string }) => {
    const price = priceOf(stock.symbol, 0);
    setPortfolio((prev) => {
      const idx = prev.findIndex((h) => h.symbol === stock.symbol);
      if (idx === -1) return [...prev, { symbol: stock.symbol, name: stock.name, code: stock.code, qty: 1, avgPrice: price }];
      const next = [...prev];
      const h = next[idx];
      const qty = h.qty + 1;
      next[idx] = { ...h, qty, avgPrice: Math.round((h.avgPrice * h.qty + price) / qty) };
      return next;
    });
    setJustAdded(stock.symbol);
    window.setTimeout(() => setJustAdded((s) => (s === stock.symbol ? null : s)), 1200);
  };

  const sellHolding = (symbol: string) => setPortfolio((prev) => prev.filter((h) => h.symbol !== symbol));

  const filtered = STOCK_UNIVERSE.filter((s) => {
    const q = query.trim();
    return !q || s.name.includes(q) || s.code.includes(q);
  });

  const totalEval = portfolio.reduce((sum, h) => sum + priceOf(h.symbol, h.avgPrice) * h.qty, 0);
  const totalCost = portfolio.reduce((sum, h) => sum + h.avgPrice * h.qty, 0);
  const totalGain = totalEval - totalCost;
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5 px-1">
        <span className={`w-1.5 h-1.5 rounded-full ${status === "live" ? "bg-emerald-500 animate-pulse" : "bg-gray-300"}`} />
        <span className="text-[11px] text-gray-400">
          {status === "live" && updatedAt
            ? `${new Date(updatedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} 기준 실시간 시세`
            : status === "loading"
              ? "시세 불러오는 중…"
              : "실시간 연결 안 됨 · 전날 종가 기준"}
        </span>
      </div>

      <div className="bg-white rounded-2xl p-5 hover:shadow-lg transition-all">
        <p className="text-[14px] font-bold text-gray-900 mb-3">시장 현황</p>
        <div className="flex justify-around">
          {INDICES.map((idx, i) => {
            const q = quotes[idx.symbol];
            const up = q?.ok ? (q.changePct ?? 0) >= 0 : idx.fallbackUp;
            const value = q?.ok && q.price != null
              ? q.price.toLocaleString("ko-KR", { minimumFractionDigits: idx.decimals, maximumFractionDigits: idx.decimals })
              : idx.fallbackValue;
            const change = q?.ok && q.changePct != null ? fmtPct(q.changePct) : idx.fallbackChange;
            return (
              <div
                key={idx.label}
                className={`${i > 0 ? "border-l border-gray-100 pl-4" : ""} flex-1 text-center`}
              >
                <p className="text-[11px] text-gray-400 mb-1">{idx.label}</p>
                <p className="text-[15px] font-bold text-gray-900">{value}</p>
                <p className={`text-[12px] font-semibold mt-0.5 ${up ? "text-red-500" : "text-blue-500"}`}>
                  {change}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 hover:shadow-lg transition-all">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[14px] font-bold text-gray-900">내 포트폴리오</p>
          <button
            onClick={() => setSearchOpen(true)}
            className="text-[12px] font-bold active:scale-95 transition-transform"
            style={{ color: "var(--ac-600)" }}
          >
            + 종목 찾기
          </button>
        </div>

        {portfolio.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" className="w-7 h-7">
                <rect x="4" y="14" width="3" height="7" rx="0.5" />
                <rect x="8.5" y="11" width="3" height="10" rx="0.5" />
                <rect x="13" y="8" width="3" height="13" rx="0.5" />
                <rect x="17.5" y="5" width="3" height="16" rx="0.5" />
              </svg>
            </div>
            <p className="text-[14px] font-semibold text-gray-500">보유 종목이 없어요</p>
            <p className="text-[12px] text-gray-400 mt-1">관심 종목을 추가하고 투자를 시작해보세요</p>
            <button
              onClick={() => setSearchOpen(true)}
              className="mt-4 px-5 py-2 rounded-xl text-[13px] font-bold text-white active:scale-[0.98] transition-transform"
              style={{ background: "var(--ac-500)" }}
            >
              종목 찾기
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 mt-3">
            <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-gray-400">평가금액</p>
                <p className="text-[18px] font-black text-gray-900">{Math.round(totalEval).toLocaleString()}원</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-gray-400">평가손익</p>
                <p className={`text-[14px] font-bold ${totalGain >= 0 ? "text-red-500" : "text-blue-500"}`}>
                  {totalGain >= 0 ? "+" : ""}{Math.round(totalGain).toLocaleString()}원 ({fmtPct(totalGainPct)})
                </p>
              </div>
            </div>

            <div className="flex flex-col divide-y divide-gray-50">
              {portfolio.map((h) => {
                const cur = priceOf(h.symbol, h.avgPrice);
                const gain = (cur - h.avgPrice) * h.qty;
                const gainPct = h.avgPrice > 0 ? ((cur - h.avgPrice) / h.avgPrice) * 100 : 0;
                return (
                  <div key={h.symbol} className="flex items-center justify-between py-3 gap-2">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-gray-900 truncate">{h.name}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{h.qty}주 · 평균 {Math.round(h.avgPrice).toLocaleString()}원</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[14px] font-bold text-gray-900">{Math.round(cur * h.qty).toLocaleString()}원</p>
                      <p className={`text-[12px] font-semibold mt-0.5 ${gain >= 0 ? "text-red-500" : "text-blue-500"}`}>
                        {gain >= 0 ? "+" : ""}{Math.round(gain).toLocaleString()}원 ({fmtPct(gainPct)})
                      </p>
                    </div>
                    <button
                      onClick={() => sellHolding(h.symbol)}
                      className="text-[11px] text-gray-400 border border-gray-200 rounded-lg px-2.5 py-1.5 active:scale-95 hover:bg-gray-50 transition-all shrink-0"
                    >
                      매도
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl p-5 hover:shadow-lg transition-all">
        <p className="text-[14px] font-bold text-gray-900 mb-3">관심 종목</p>
        <div className="flex flex-col gap-1">
          {WATCHLIST.map((stock) => {
            const q = quotes[stock.symbol];
            const up = q?.ok ? (q.changePct ?? 0) >= 0 : stock.fallbackUp;
            const price = q?.ok && q.price != null ? Math.round(q.price).toLocaleString("ko-KR") : stock.fallbackPrice;
            const change = q?.ok && q.changePct != null ? fmtPct(q.changePct) : stock.fallbackChange;
            const held = portfolio.find((h) => h.symbol === stock.symbol);
            return (
              <div
                key={stock.code}
                className="flex items-center justify-between py-3 -mx-1 px-1 rounded-xl hover:bg-gray-50 transition-all"
              >
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-gray-900 truncate">{stock.name}{held ? ` · 보유 ${held.qty}주` : ""}</p>
                  <p className="text-[12px] text-gray-400 mt-0.5">{stock.code}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-[15px] font-bold text-gray-900">{price}원</p>
                    <p className={`text-[13px] font-semibold mt-0.5 ${up ? "text-red-500" : "text-blue-500"}`}>
                      {change}
                    </p>
                  </div>
                  <button
                    onClick={() => addToPortfolio(stock)}
                    className={`text-[11px] font-bold rounded-lg px-2.5 py-1.5 active:scale-95 transition-all ${justAdded === stock.symbol ? "bg-emerald-500 text-white" : "text-white"}`}
                    style={justAdded === stock.symbol ? undefined : { background: "var(--ac-500)" }}
                  >
                    {justAdded === stock.symbol ? "담김✓" : "담기"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── 종목 찾기 바텀시트 ────────────────────────────────────────────── */}
      {searchOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            style={{ animation: "fade-in 180ms ease-out both" }}
            onClick={() => setSearchOpen(false)}
          />
          <div
            className="absolute bottom-0 left-0 right-0 mx-auto w-full bg-white rounded-t-3xl px-5 pt-5 pb-6 flex flex-col"
            style={{ maxWidth: 430, maxHeight: "82vh", animation: "sheet-up 240ms cubic-bezier(.2,.8,.2,1) both" }}
          >
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-4 shrink-0" />
            <div className="flex items-center justify-between mb-3 shrink-0">
              <p className="text-[18px] font-bold text-gray-900">종목 찾기</p>
              <button onClick={() => setSearchOpen(false)} className="text-gray-400 active:scale-90 transition-transform">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="종목명 또는 코드 검색"
              className="w-full bg-gray-50 rounded-xl px-4 py-3 text-[14px] text-gray-900 outline-none mb-2 shrink-0"
            />
            <div className="flex-1 overflow-y-auto flex flex-col -mx-1 px-1">
              {filtered.length === 0 && (
                <p className="text-center text-gray-400 text-[13px] py-10">검색 결과가 없어요</p>
              )}
              {filtered.map((s) => {
                const q = quotes[s.symbol];
                const held = portfolio.find((h) => h.symbol === s.symbol);
                return (
                  <div key={s.symbol} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-gray-900 truncate">{s.name}{held ? ` · 보유 ${held.qty}주` : ""}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {s.code}{q?.ok && q.price != null ? ` · ${Math.round(q.price).toLocaleString()}원` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => addToPortfolio(s)}
                      className={`text-[12px] font-bold rounded-lg px-3 py-1.5 active:scale-95 transition-all shrink-0 ${justAdded === s.symbol ? "bg-emerald-500 text-white" : "text-white"}`}
                      style={justAdded === s.symbol ? undefined : { background: "var(--ac-500)" }}
                    >
                      {justAdded === s.symbol ? "담았어요 ✓" : "담기"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
