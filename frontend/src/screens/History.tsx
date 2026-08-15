// 계좌 거래내역 — 홈에서 계좌를 누르면 들어온다.
// 조회 전용 화면이라 상태가 없다. 계좌 정보는 전부 props 로 받는다.
// 부모(한결은행)·자녀(나눔은행) 양쪽이 함께 쓰며, theme 으로 색만 갈아끼운다.

import { TRANSACTIONS, fmtAccount } from "../shared/data";
import { PageHeader } from "../shared/ui";

type Account = { name: string; account: string; bank: string; balance: string };

const THEME = {
  parent: {
    pageBg: "from-[#fafbfe] via-[#fafbfe]",
    income: "text-blue-600",
    tag: "text-blue-500",
    cta: "bg-blue-500 hover:bg-blue-600",
    badge: "from-blue-600 to-cyan-400",
  },
  child: {
    pageBg: "from-white via-white",
    income: "text-emerald-600",
    tag: "text-emerald-500",
    cta: "bg-emerald-600 hover:bg-emerald-700",
    badge: "from-emerald-600 to-teal-400",
  },
} as const;

export default function History({
  account: acc, onBack, onTransfer, onGuardian, theme = "parent",
}: {
  account: Account; onBack: () => void; onTransfer: () => void; onGuardian: () => void;
  theme?: keyof typeof THEME;
}) {
  const t = THEME[theme];
  const rows = TRANSACTIONS[acc.account] ?? [];

  // 같은 날짜끼리 묶는다 — 날짜 머리글을 한 번만 찍기 위해
  const groups = rows.reduce<{ date: string; items: typeof rows }[]>((out, row) => {
    const last = out[out.length - 1];
    if (last && last.date === row.date) last.items.push(row);
    else out.push({ date: row.date, items: [row] });
    return out;
  }, []);

  return (
    <div className="flex flex-col">
      <PageHeader title={acc.name} onBack={onBack} />

      {/* 계좌번호 + 잔액 */}
      <div className="px-1 pt-3">
        <p className="text-[14px] text-gray-500 underline underline-offset-4 decoration-gray-300">
          {acc.bank} {fmtAccount(acc.account)}
        </p>
        <p className="text-[32px] font-bold text-gray-900 mt-1.5 tracking-tight">{acc.balance}원</p>
      </div>

      {/* 조회 조건 — 데모에서는 표시만 */}
      <div className="mt-5 bg-gray-100/70 rounded-xl px-4 py-3 flex items-center justify-between">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-[18px] h-[18px] text-gray-400">
          <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
        </svg>
        <span className="flex items-center gap-1 text-[13px] text-gray-500">
          3개월 · 전체 · 최신순
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4"><path d="M6 9l6 6 6-6" /></svg>
        </span>
      </div>

      {/* 안심동행 AI 배너 */}
      <button
        onClick={onGuardian}
        className="mt-3 flex items-center gap-3 px-1 py-3 text-left border-b border-gray-100 active:scale-[0.99] transition-transform"
      >
        <span className={`w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br ${t.badge} flex items-center justify-center`}>
          <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5"><path d="M12 2l8 3.5v6c0 4.6-3.4 8.9-8 10.5-4.6-1.6-8-5.9-8-10.5v-6L12 2z" /></svg>
        </span>
        <span className="min-w-0">
          <span className="block text-[12px] text-gray-400">혼자 결정하지 않도록</span>
          <span className="block text-[14px] font-bold text-gray-900">안심동행 AI로 가족과 함께 지켜요</span>
        </span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4 text-gray-300 ml-auto shrink-0"><path d="M9 6l6 6-6 6" /></svg>
      </button>

      {/* 거래 목록 — 날짜별 묶음 */}
      {groups.length === 0 ? (
        <p className="text-[13px] text-gray-400 py-16 text-center">거래내역이 없어요</p>
      ) : (
        groups.map((g) => (
          <div key={g.date} className="px-1">
            <p className="text-[13px] font-bold text-gray-900 pt-6 pb-1">{g.date}</p>
            {g.items.map((row, i) => (
              <div key={i} className="flex items-start justify-between py-3.5 -mx-2 px-2 rounded-xl hover:bg-gray-50 transition-colors">
                <div className="min-w-0 pr-3">
                  <p className="text-[15px] text-gray-900 truncate">{row.name}</p>
                  <p className="text-[13px] text-gray-400 mt-1">
                    {row.time}
                    <span className={row.amount > 0 ? `${t.tag} ml-2` : "ml-2"}>#{row.memo}</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-[15px] font-bold ${row.amount > 0 ? t.income : "text-gray-900"}`}>
                    {row.amount > 0 ? "+" : "-"}{Math.abs(row.amount).toLocaleString()}원
                  </p>
                  <p className="text-[13px] text-gray-400 mt-1">{row.balance.toLocaleString()}원</p>
                </div>
              </div>
            ))}
          </div>
        ))
      )}

      {/* 송금하기 — 스크롤해도 하단 탭바 바로 위에 계속 떠 있다 */}
      <div className={`sticky bottom-[72px] z-10 mt-4 pt-4 pb-2 bg-gradient-to-t ${t.pageBg} via-70% to-transparent`}>
        <button
          onClick={onTransfer}
          className={`w-full py-4 rounded-xl text-[16px] font-bold text-white ${t.cta} active:scale-[0.98] transition-all`}
        >
          송금하기
        </button>
      </div>
    </div>
  );
}
