// 헤더 돋보기 검색 — 은행 앱 안의 페이지다. 메뉴·상품·기능을 이름으로 찾아 바로 이동한다.

import { useState } from "react";

export type SearchItem = {
  label: string;
  desc?: string;
  keywords?: string[];
  onSelect: () => void;
};

export default function SearchOverlay({ items, onClose }: { items: SearchItem[]; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const q = query.trim();
  const filtered = !q
    ? items
    : items.filter((i) => i.label.includes(q) || i.desc?.includes(q) || i.keywords?.some((k) => k.includes(q)));

  return (
    <div className="fixed inset-0 z-[100] flex justify-center" role="dialog" aria-label="검색" aria-modal="true">
      <button aria-label="검색 닫기" onClick={onClose} className="absolute inset-0 bg-black/25" />

      <div className="absolute inset-y-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 overflow-hidden">
        <section className="relative flex h-dvh max-h-dvh w-full flex-col overflow-hidden bg-white shadow-2xl">
          <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 px-4 py-3">
            <button aria-label="뒤로" onClick={onClose} className="rounded-full p-1.5 text-gray-700 active:scale-90 transition-transform">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="메뉴·상품·기능 검색"
              className="min-w-0 flex-1 rounded-xl bg-gray-100 px-4 py-2.5 text-[15px] text-gray-900 outline-none"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#e2edfe]">
            {filtered.length === 0 ? (
              <p className="py-16 text-center text-[13px] text-gray-400">검색 결과가 없어요</p>
            ) : (
              <div className="divide-y divide-gray-100 bg-white">
                {filtered.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => { item.onSelect(); onClose(); }}
                    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left active:bg-black/5 transition-colors"
                  >
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold text-gray-900">{item.label}</span>
                      {item.desc && <span className="mt-0.5 block text-[12px] text-gray-400">{item.desc}</span>}
                    </span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4 shrink-0 text-gray-300"><path d="M9 6l6 6-6 6" /></svg>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
