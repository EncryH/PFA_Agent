// 하단 탭바 — 금융 / 상품 / 혜택 / 주식 탭 화면 모음.
// 각 탭은 App.tsx 에서 page === "home" && tab === "X" 조건으로 렌더링된다.

import { MY_ACCOUNTS, SAVINGS_INFO, parseAmt } from "../shared/data";
import { BankLogo } from "../shared/ui";

const fmt = (n: number) => n.toLocaleString("ko-KR");

// ═══════════════════════════════════════════════════════════════════════════════
// 1. FinancialTab — 자산 현황, 계좌별 바 차트, 월별 지출
// ═══════════════════════════════════════════════════════════════════════════════
export function FinancialTab({ onAccount }: { onAccount: (i: number) => void }) {
  const balances = MY_ACCOUNTS.map((a) => parseAmt(a.balance));
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
        <p className="text-[12px] text-gray-400 mt-0.5">{MY_ACCOUNTS.length}개 계좌</p>
      </div>

      {/* 계좌별 자산 바 차트 */}
      <div className="bg-white rounded-2xl p-5 hover:shadow-lg transition-all">
        <p className="text-[14px] font-bold text-gray-900 mb-4">계좌별 자산</p>
        <div className="flex flex-col gap-4">
          {MY_ACCOUNTS.map((acc, i) => {
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
            {MY_ACCOUNTS.map((a, i) => `${a.bank.replace(/은행|뱅크/, "")} ${Math.round((balances[i] / total) * 100)}%`).join(" · ")}
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

const RECOMMEND = [
  { title: "프리미엄 예금",   desc: "연 3.8% · 24개월",   tag: "금리우대" },
  { title: "청년 희망 적금",  desc: "연 5.0% · 청년전용", tag: "인기" },
  { title: "중금리 신용대출", desc: "최저 연 5.9%",        tag: "신규" },
  { title: "ISA 절세 계좌",  desc: "비과세 · 소득공제",   tag: "절세" },
];

export function ProductsTab({ onSavings }: { onSavings: (i: number) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="bg-white rounded-2xl p-5 hover:shadow-lg transition-all">
        <p className="text-[14px] font-bold text-gray-900 mb-3">내 상품</p>
        <div className="flex flex-col gap-3">
          {SAVINGS_INDICES.map((idx) => {
            const acc = MY_ACCOUNTS[idx];
            const info = SAVINGS_INFO[acc.account];
            return (
              <button
                key={acc.account}
                onClick={() => onSavings(idx)}
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

      <div className="bg-white rounded-2xl p-5 hover:shadow-lg transition-all">
        <p className="text-[14px] font-bold text-gray-900 mb-3">추천 상품</p>
        <div className="grid grid-cols-2 gap-3">
          {RECOMMEND.map((p) => (
            <div
              key={p.title}
              className="rounded-xl bg-blue-50/60 p-4 cursor-pointer hover:bg-blue-100/60 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] transition-all"
            >
              <span
                className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-md mb-2 text-white"
                style={{ background: "var(--ac-500)" }}
              >
                {p.tag}
              </span>
              <p className="text-[13px] font-semibold text-gray-900">{p.title}</p>
              <p className="text-[11px] text-gray-400 mt-1">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. BenefitsTab — 포인트, 혜택 목록, 월별 요약
// ═══════════════════════════════════════════════════════════════════════════════
const BENEFITS = [
  { title: "자동이체 우대",     desc: "아파트 관리비 자동이체 등록", savings: "월 2,000원 할인" },
  { title: "급여이체 우대금리", desc: "입출금통장 급여이체 인정",    savings: "+0.3%p 적용" },
  { title: "인터넷뱅킹 할인",  desc: "이체 수수료 전액 면제",       savings: "월 최대 5,000원" },
  { title: "시니어 우대",      desc: "60세 이상 고객 대상",         savings: "환전 50% 할인" },
];

const MONTHLY_SUMMARY = [
  { label: "획득 포인트", value: "340P" },
  { label: "사용 포인트", value: "0P" },
  { label: "절약 금액",   value: "7,000원" },
];

export function BenefitsTab() {
  return (
    <div className="flex flex-col gap-3">
      <div
        className="rounded-2xl p-6 flex items-center justify-between hover:shadow-xl hover:-translate-y-0.5 transition-all"
        style={{ background: "linear-gradient(135deg, var(--ac-600), var(--ac-400))" }}
      >
        <div>
          <p className="text-[13px] text-white/70 mb-1">보유 포인트</p>
          <p className="text-[34px] font-bold text-white tracking-tight">12,340P</p>
          <p className="text-[12px] text-white/60 mt-1">현금 12,340원 상당</p>
        </div>
        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="white" className="w-8 h-8">
            <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm1 14.5V18h-2v-1.5a3.5 3.5 0 01-3.5-3.5H9a1.5 1.5 0 001.5 1.5h3a1.5 1.5 0 000-3h-3a3.5 3.5 0 010-7V6h2v1.5a3.5 3.5 0 013.5 3.5H15a1.5 1.5 0 00-1.5-1.5h-3a1.5 1.5 0 000 3h3a3.5 3.5 0 010 7z" />
          </svg>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 hover:shadow-lg transition-all">
        <p className="text-[14px] font-bold text-gray-900 mb-3">활성 혜택</p>
        <div className="flex flex-col gap-2">
          {BENEFITS.map((b) => (
            <div
              key={b.title}
              className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3"
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
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 hover:shadow-lg transition-all">
        <p className="text-[14px] font-bold text-gray-900 mb-3">9월 혜택 요약</p>
        <div className="flex justify-around text-center">
          {MONTHLY_SUMMARY.map((item, i) => (
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
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. StocksTab — 주가 지수, 빈 포트폴리오, 관심 종목
// ═══════════════════════════════════════════════════════════════════════════════
const INDICES = [
  { label: "KOSPI",   value: "2,641.42", change: "+0.73%", up: true  },
  { label: "KOSDAQ",  value: "762.18",   change: "-0.14%", up: false },
  { label: "USD/KRW", value: "1,327.50", change: "+0.22%", up: true  },
];

const WATCHLIST = [
  { name: "삼성전자",  code: "005930", price: "71,200",  change: "+1.28%", up: true  },
  { name: "SK하이닉스", code: "000660", price: "182,500", change: "+2.11%", up: true  },
  { name: "NAVER",    code: "035420", price: "194,000", change: "-0.51%", up: false },
  { name: "카카오",   code: "035720", price: "44,350",  change: "-1.34%", up: false },
];

export function StocksTab() {
  return (
    <div className="flex flex-col gap-3">
      <div className="bg-white rounded-2xl p-5 hover:shadow-lg transition-all">
        <p className="text-[14px] font-bold text-gray-900 mb-3">시장 현황</p>
        <div className="flex justify-around">
          {INDICES.map((idx, i) => (
            <div
              key={idx.label}
              className={`${i > 0 ? "border-l border-gray-100 pl-4" : ""} flex-1 text-center`}
            >
              <p className="text-[11px] text-gray-400 mb-1">{idx.label}</p>
              <p className="text-[15px] font-bold text-gray-900">{idx.value}</p>
              <p className={`text-[12px] font-semibold mt-0.5 ${idx.up ? "text-red-500" : "text-blue-500"}`}>
                {idx.change}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 hover:shadow-lg transition-all">
        <p className="text-[14px] font-bold text-gray-900 mb-1">내 포트폴리오</p>
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
            className="mt-4 px-5 py-2 rounded-xl text-[13px] font-bold text-white active:scale-[0.98] transition-transform"
            style={{ background: "var(--ac-500)" }}
          >
            종목 찾기
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 hover:shadow-lg transition-all">
        <p className="text-[14px] font-bold text-gray-900 mb-3">관심 종목</p>
        <div className="flex flex-col gap-1">
          {WATCHLIST.map((stock) => (
            <div
              key={stock.code}
              className="flex items-center justify-between py-3 -mx-1 px-1 rounded-xl hover:bg-gray-50 active:scale-[0.98] transition-all cursor-pointer"
            >
              <div>
                <p className="text-[15px] font-semibold text-gray-900">{stock.name}</p>
                <p className="text-[12px] text-gray-400 mt-0.5">{stock.code}</p>
              </div>
              <div className="text-right">
                <p className="text-[15px] font-bold text-gray-900">{stock.price}원</p>
                <p className={`text-[13px] font-semibold mt-0.5 ${stock.up ? "text-red-500" : "text-blue-500"}`}>
                  {stock.change}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
