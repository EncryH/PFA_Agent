import { useState } from "react";
import { MONTHLY_SPENDING_ROWS, MONTHLY_SPENDING_TOTAL, type MonthlySpendingCategory } from "../shared/monthlySpending";
import { PageHeader } from "../shared/ui";

type SpendingFilter = {
  category: "전체" | MonthlySpendingCategory;
  sort: "최신순" | "오래된순";
};

const DEFAULT_FILTER: SpendingFilter = { category: "전체", sort: "최신순" };

const formatDate = (date: string) => {
  const [month, day] = date.split(".");
  return `${Number(month)}월 ${Number(day)}일`;
};

export default function MonthlySpending({
  onBack,
  onGuardian,
  onTransfer,
}: {
  onBack: () => void;
  onGuardian: () => void;
  onTransfer: () => void;
}) {
  const [filter, setFilter] = useState<SpendingFilter>(DEFAULT_FILTER);
  const [pendingFilter, setPendingFilter] = useState<SpendingFilter>(DEFAULT_FILTER);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filteredRows = MONTHLY_SPENDING_ROWS
    .filter((row) => filter.category === "전체" || row.category === filter.category)
    .toSorted((left, right) => {
      const comparison = left.date.localeCompare(right.date) || left.time.localeCompare(right.time);
      return filter.sort === "오래된순" ? comparison : -comparison;
    });
  const groups = filteredRows.reduce<{ date: string; rows: typeof filteredRows }[]>((result, row) => {
    const latest = result[result.length - 1];
    if (latest?.date === row.date) latest.rows.push(row);
    else result.push({ date: row.date, rows: [row] });
    return result;
  }, []);
  const selectedRow = MONTHLY_SPENDING_ROWS.find((row) => row.id === selectedId) ?? null;
  const filterLabel = `9월 · ${filter.category} · ${filter.sort}`;

  return (
    <div className="flex flex-col">
      <PageHeader title="9월 이용 내역" onBack={onBack} />

      <div className="px-1 pt-3">
        <p className="text-[14px] text-gray-500 underline decoration-gray-300 underline-offset-4">한결은행 입출금통장 · 9월</p>
        <p className="mt-1.5 text-[32px] font-bold tracking-tight text-gray-900">{MONTHLY_SPENDING_TOTAL.toLocaleString("ko-KR")}원</p>
        <p className="mt-1 text-[12px] text-gray-400">9월 누적 사용 금액 · 입금 제외</p>
      </div>

      <button
        type="button"
        onClick={() => {
          setPendingFilter(filter);
          setFilterOpen(true);
        }}
        className="mt-5 flex items-center justify-between rounded-xl bg-gray-100/70 px-4 py-3 transition-transform active:scale-[0.99]"
        aria-label={`조회 조건 변경, 현재 ${filterLabel}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-[18px] w-[18px] text-gray-400" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <span className="flex items-center gap-1 text-[13px] text-gray-500">
          {filterLabel}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>

      <button
        type="button"
        onClick={onGuardian}
        className="mt-3 flex items-center gap-3 border-b border-gray-100 px-1 py-3 text-left transition-transform active:scale-[0.99]"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-400">
          <svg viewBox="0 0 24 24" fill="white" className="h-5 w-5" aria-hidden="true">
            <path d="M12 2l8 3.5v6c0 4.6-3.4 8.9-8 10.5-4.6-1.6-8-5.9-8-10.5v-6L12 2z" />
          </svg>
        </span>
        <span className="min-w-0">
          <span className="block text-[12px] text-gray-400">혼자 결정하지 않도록</span>
          <span className="block text-[14px] font-bold text-gray-900">안심동행 AI로 가족과 함께 지켜요</span>
        </span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="ml-auto h-4 w-4 shrink-0 text-gray-300" aria-hidden="true">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>

      {groups.length === 0 ? (
        <p className="py-16 text-center text-[13px] text-gray-400">해당하는 거래내역이 없어요.</p>
      ) : (
        groups.map((group) => (
          <div key={group.date} className="px-1">
            <p className="pb-1 pt-6 text-[13px] font-bold text-gray-900">{formatDate(group.date)}</p>
            {group.rows.map((row) => (
              <button
                type="button"
                key={row.id}
                onClick={() => setSelectedId(row.id)}
                className="-mx-2 flex w-full items-start justify-between rounded-xl px-2 py-3.5 text-left transition-all hover:bg-gray-50 active:scale-[0.98]"
              >
                <span className="min-w-0 pr-3">
                  <span className="block truncate text-[15px] text-gray-900">{row.name}</span>
                  <span className="mt-1 block text-[13px] text-gray-400">
                    {row.time}<span className="ml-2">#{row.category}</span>
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block whitespace-nowrap text-[15px] font-bold text-gray-900">-{row.amount.toLocaleString("ko-KR")}원</span>
                  <span className="mt-1 block max-w-[150px] truncate text-[12px] text-gray-400">{row.account}</span>
                </span>
              </button>
            ))}
          </div>
        ))
      )}

      <div className="sticky bottom-[72px] z-10 mt-4 bg-gradient-to-t from-[#fafbfe] via-[#fafbfe] via-70% to-transparent pb-2 pt-4">
        <button
          type="button"
          onClick={onTransfer}
          className="w-full rounded-xl bg-blue-500 py-4 text-[16px] font-bold text-white transition-all hover:bg-blue-600 active:scale-[0.98]"
        >
          송금하기
        </button>
      </div>

      {filterOpen && (
        <div className="fixed inset-0 z-50">
          <button type="button" aria-label="조회 조건 닫기" className="absolute inset-0 h-full w-full bg-black/40" onClick={() => setFilterOpen(false)} />
          <div
            className="absolute bottom-0 left-0 right-0 mx-auto w-full rounded-t-3xl bg-white px-5 pb-8 pt-5"
            style={{ maxWidth: 430, animation: "sheet-up 240ms cubic-bezier(.2,.8,.2,1) both" }}
          >
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-gray-200" />
            <p className="mb-2 text-[13px] font-bold text-gray-500">구분</p>
            <div className="mb-4 flex flex-wrap gap-2">
              {(["전체", "이체", "자동이체", "체크카드"] as const).map((category) => (
                <button
                  type="button"
                  key={category}
                  onClick={() => setPendingFilter((current) => ({ ...current, category }))}
                  className={`rounded-full border px-4 py-1.5 text-[13px] font-semibold transition-all ${
                    pendingFilter.category === category ? "border-transparent bg-blue-500 text-white" : "border-gray-200 bg-white text-gray-600"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
            <p className="mb-2 text-[13px] font-bold text-gray-500">정렬</p>
            <div className="mb-6 flex gap-2">
              {(["최신순", "오래된순"] as const).map((sort) => (
                <button
                  type="button"
                  key={sort}
                  onClick={() => setPendingFilter((current) => ({ ...current, sort }))}
                  className={`rounded-full border px-4 py-1.5 text-[13px] font-semibold transition-all ${
                    pendingFilter.sort === sort ? "border-transparent bg-blue-500 text-white" : "border-gray-200 bg-white text-gray-600"
                  }`}
                >
                  {sort}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setFilter(pendingFilter);
                setFilterOpen(false);
              }}
              className="w-full rounded-xl bg-blue-500 py-4 text-[16px] font-bold text-white transition-all active:scale-[0.98]"
            >
              적용
            </button>
          </div>
        </div>
      )}

      {selectedRow && (
        <div className="fixed inset-0 z-50">
          <button type="button" aria-label="거래 상세 닫기" className="absolute inset-0 h-full w-full bg-black/40" onClick={() => setSelectedId(null)} />
          <div
            className="absolute bottom-0 left-0 right-0 mx-auto w-full rounded-t-3xl bg-white px-5 pb-8 pt-5"
            style={{ maxWidth: 430, animation: "sheet-up 240ms cubic-bezier(.2,.8,.2,1) both" }}
          >
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-gray-200" />
            <p className="text-[22px] font-bold text-gray-900">{selectedRow.name}</p>
            <p className="mt-1 text-[30px] font-bold tracking-tight text-gray-900">-{selectedRow.amount.toLocaleString("ko-KR")}원</p>
            <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-gray-500">날짜 · 시각</span>
                <span className="text-[13px] font-semibold text-gray-900">{formatDate(selectedRow.date)} · {selectedRow.time}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-gray-500">거래 구분</span>
                <span className="text-[13px] font-semibold text-gray-900">{selectedRow.category}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="shrink-0 text-[13px] text-gray-500">출금 계좌</span>
                <span className="truncate text-[13px] font-semibold text-gray-900">{selectedRow.account}</span>
              </div>
            </div>
            <button type="button" onClick={() => setSelectedId(null)} className="mt-5 w-full rounded-xl bg-blue-500 py-4 text-[15px] font-bold text-white transition-all active:scale-[0.98]">
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
