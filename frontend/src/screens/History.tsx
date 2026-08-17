// 계좌 거래내역 — 홈에서 계좌를 누르면 들어온다.
// 부모(한결은행)·자녀(나눔은행) 양쪽이 함께 쓰며, theme 으로 색만 갈아끼운다.
// 필터 바텀시트, 거래 상세 패널 포함.

import { useState } from "react";
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
    pill: "bg-blue-500 text-white",
  },
  child: {
    pageBg: "from-white via-white",
    income: "text-emerald-600",
    tag: "text-emerald-500",
    cta: "bg-emerald-600 hover:bg-emerald-700",
    badge: "from-emerald-600 to-teal-400",
    pill: "bg-emerald-500 text-white",
  },
} as const;

type FilterState = {
  period: "1개월" | "3개월" | "6개월" | "1년";
  txType: "전체" | "입금" | "출금";
  sort: "최신순" | "오래된순";
};

const DEFAULT_FILTER: FilterState = { period: "3개월", txType: "전체", sort: "최신순" };

export default function History({
  account: acc, onBack, onTransfer, onGuardian, theme = "parent",
}: {
  account: Account; onBack: () => void; onTransfer: () => void; onGuardian: () => void;
  theme?: keyof typeof THEME;
}) {
  const t = THEME[theme];

  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [pendingFilter, setPendingFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const allRows = TRANSACTIONS[acc.account] ?? [];

  const filteredRows = allRows
    .filter((row) => {
      if (filter.txType === "입금") return row.amount > 0;
      if (filter.txType === "출금") return row.amount < 0;
      return true;
    })
    .sort((a, b) => {
      if (filter.sort === "오래된순") {
        return a.date.localeCompare(b.date) || a.time.localeCompare(b.time);
      }
      return b.date.localeCompare(a.date) || b.time.localeCompare(a.time);
    });

  const groups = filteredRows.reduce<{ date: string; items: typeof filteredRows }[]>((out, row) => {
    const last = out[out.length - 1];
    if (last && last.date === row.date) last.items.push(row);
    else out.push({ date: row.date, items: [row] });
    return out;
  }, []);

  const filterLabel = `${filter.period} · ${filter.txType} · ${filter.sort}`;

  const makeTxnNo = (rowIdx: number) => {
    const last6 = acc.account.slice(-6);
    const row = filteredRows[rowIdx];
    const digits = (row?.date ?? "").replace(/\D/g, "") + (row?.time ?? "").replace(/\D/g, "");
    return `TXN${last6}${digits}${rowIdx.toString().padStart(3, "0")}`;
  };

  const selectedRow = selectedIdx !== null ? filteredRows[selectedIdx] : null;

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

      {/* 조회 조건 — 클릭하면 필터 바텀시트 */}
      <button
        onClick={() => { setPendingFilter(filter); setFilterOpen(true); }}
        className="mt-5 bg-gray-100/70 rounded-xl px-4 py-3 flex items-center justify-between active:scale-[0.99] transition-transform"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-[18px] h-[18px] text-gray-400">
          <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
        </svg>
        <span className="flex items-center gap-1 text-[13px] text-gray-500">
          {filterLabel}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4"><path d="M6 9l6 6 6-6" /></svg>
        </span>
      </button>

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
            {g.items.map((row, i) => {
              const globalIdx = filteredRows.indexOf(row);
              return (
                <button
                  key={i}
                  onClick={() => setSelectedIdx(globalIdx)}
                  className="w-full flex items-start justify-between py-3.5 -mx-2 px-2 rounded-xl hover:bg-gray-50 active:scale-[0.98] transition-all text-left"
                >
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
                </button>
              );
            })}
          </div>
        ))
      )}

      {/* 송금하기 */}
      <div className={`sticky bottom-[72px] z-10 mt-4 pt-4 pb-2 bg-gradient-to-t ${t.pageBg} via-70% to-transparent`}>
        <button
          onClick={onTransfer}
          className={`w-full py-4 rounded-xl text-[16px] font-bold text-white ${t.cta} active:scale-[0.98] transition-all`}
        >
          송금하기
        </button>
      </div>

      {/* ─── 필터 바텀시트 ─────────────────────────────────────────────────── */}
      {filterOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            style={{ animation: "fade-in 180ms ease-out both" }}
            onClick={() => setFilterOpen(false)}
          />
          <div
            className="absolute bottom-0 bg-white rounded-t-3xl px-5 pt-5 pb-8"
            style={{ left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, animation: "sheet-up 240ms cubic-bezier(.2,.8,.2,1) both" }}
          >
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5" />

            <p className="text-[13px] font-bold text-gray-500 mb-2">기간</p>
            <div className="flex gap-2 flex-wrap mb-4">
              {(["1개월", "3개월", "6개월", "1년"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setPendingFilter((f) => ({ ...f, period: v }))}
                  className={`px-4 py-1.5 rounded-full text-[13px] font-semibold border transition-all ${
                    pendingFilter.period === v ? t.pill + " border-transparent" : "bg-white border-gray-200 text-gray-600"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>

            <p className="text-[13px] font-bold text-gray-500 mb-2">구분</p>
            <div className="flex gap-2 mb-4">
              {(["전체", "입금", "출금"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setPendingFilter((f) => ({ ...f, txType: v }))}
                  className={`px-4 py-1.5 rounded-full text-[13px] font-semibold border transition-all ${
                    pendingFilter.txType === v ? t.pill + " border-transparent" : "bg-white border-gray-200 text-gray-600"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>

            <p className="text-[13px] font-bold text-gray-500 mb-2">정렬</p>
            <div className="flex gap-2 mb-6">
              {(["최신순", "오래된순"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setPendingFilter((f) => ({ ...f, sort: v }))}
                  className={`px-4 py-1.5 rounded-full text-[13px] font-semibold border transition-all ${
                    pendingFilter.sort === v ? t.pill + " border-transparent" : "bg-white border-gray-200 text-gray-600"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>

            <button
              onClick={() => { setFilter(pendingFilter); setFilterOpen(false); }}
              className={`w-full py-4 rounded-xl text-[16px] font-bold text-white ${t.cta} active:scale-[0.98] transition-all`}
            >
              적용
            </button>
          </div>
        </div>
      )}

      {/* ─── 거래 상세 패널 ─────────────────────────────────────────────────── */}
      {selectedRow !== null && selectedIdx !== null && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            style={{ animation: "fade-in 180ms ease-out both" }}
            onClick={() => setSelectedIdx(null)}
          />
          <div
            className="absolute bottom-0 bg-white rounded-t-3xl px-5 pt-5 pb-8"
            style={{ left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, animation: "sheet-up 240ms cubic-bezier(.2,.8,.2,1) both" }}
          >
            <div className="flex items-center justify-between mb-5">
              <button
                onClick={() => setSelectedIdx(null)}
                className="text-gray-400 active:scale-90 transition-transform"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <div className="w-10 h-1 rounded-full bg-gray-200" />
              <div className="w-6" />
            </div>

            <p className="text-[22px] font-bold text-gray-900">{selectedRow.name}</p>
            <p className={`text-[30px] font-bold mt-1 tracking-tight ${selectedRow.amount > 0 ? t.income : "text-gray-900"}`}>
              {selectedRow.amount > 0 ? "+" : "-"}{Math.abs(selectedRow.amount).toLocaleString()}원
            </p>

            <div className="mt-5 flex flex-col gap-3 bg-gray-50 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-gray-500">거래 후 잔액</span>
                <span className="text-[13px] font-semibold text-gray-900">{selectedRow.balance.toLocaleString()}원</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-gray-500">날짜 · 시각</span>
                <span className="text-[13px] font-semibold text-gray-900">{selectedRow.date} · {selectedRow.time}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-gray-500">거래 구분</span>
                <span className="text-[13px] font-semibold text-gray-900">{selectedRow.memo}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-gray-500">거래번호</span>
                <span className="text-[11px] font-mono text-gray-500">{makeTxnNo(selectedIdx)}</span>
              </div>
            </div>

            <button
              onClick={() => { setSelectedIdx(null); onTransfer(); }}
              className={`w-full mt-5 py-4 rounded-xl text-[15px] font-bold text-white ${t.cta} active:scale-[0.98] transition-all`}
            >
              이 계좌로 송금하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
