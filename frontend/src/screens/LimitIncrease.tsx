// 이체한도 상향 — 현재 한도 확인 → 새 한도 선택 → 신청 완료.
// 한도를 올린 직후 큰 금액을 보내라는 요청은 전형적인 보이스피싱 수법이라, 신청 사실이
// App 레벨 behaviorSignals(limitIncreased)로 넘어가 다음 송금의 위험 점수에 반영된다.

import { useState } from "react";

const OPTIONS = [10_000_000, 30_000_000, 50_000_000, 100_000_000];
const fmt = (n: number) => n.toLocaleString("ko-KR");

export default function LimitIncrease({
  currentLimit, onBack, onIncreased,
}: {
  currentLimit: number;
  onBack: () => void;
  onIncreased: (limit: number) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [done, setDone] = useState<number | null>(null);

  if (done !== null) {
    return (
      <div className="flex flex-col gap-4 pb-6 items-center pt-2">
        <div className="w-full flex flex-col items-center gap-5 bg-white rounded-2xl p-8">
          <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10"><path d="M20 6L9 17l-5-5" /></svg>
          </div>
          <div className="text-center">
            <p className="text-[13px] text-green-600 font-semibold mb-1">한도 상향 완료</p>
            <p className="text-[28px] font-black text-gray-900">1일 {fmt(done)}원</p>
            <p className="text-[13px] text-gray-400 mt-1">지금부터 바로 적용돼요</p>
          </div>
          <div className="w-full bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-2">
            <span className="text-[16px]">⚠️</span>
            <p className="text-[12px] text-amber-700 leading-relaxed">
              한도를 올린 직후 큰 금액을 보내라는 연락을 받으셨다면<br /><strong>보이스피싱을 의심</strong>해보세요.
            </p>
          </div>
        </div>
        <button onClick={onBack} className="w-full py-3 rounded-xl text-[14px] font-medium text-gray-500 border border-gray-200 bg-white active:scale-[0.98] transition-all">
          홈으로
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-6 pt-2">
      <button onClick={onBack} className="flex items-center gap-1 text-gray-400 active:scale-90 transition-transform w-fit">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M15 18l-6-6 6-6" /></svg>
        <span className="text-[14px] text-gray-500">뒤로</span>
      </button>

      <div className="bg-white rounded-2xl p-5">
        <p className="text-[13px] text-gray-400">현재 1일 이체한도</p>
        <p className="text-[26px] font-black text-gray-900 mt-1">{fmt(currentLimit)}원</p>
      </div>

      <div className="bg-white rounded-2xl p-5 flex flex-col gap-3">
        <p className="text-[14px] font-bold text-gray-900">상향할 한도를 선택하세요</p>
        <div className="flex flex-col gap-2">
          {OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => setSelected(opt)}
              className={`flex items-center justify-between rounded-xl px-4 py-3.5 text-left transition-all active:scale-[0.98] border-2 ${
                selected === opt ? "border-[var(--ac-500)] bg-[var(--ac-50)]" : "border-gray-100 bg-gray-50"
              }`}
            >
              <span className="text-[15px] font-semibold text-gray-900">1일 {fmt(opt)}원</span>
              {selected === opt && (
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--ac-500)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M20 6L9 17l-5-5" /></svg>
              )}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-gray-400 text-center leading-relaxed">
        한도 상향은 본인 명의 인증만으로 즉시 적용돼요.<br />
        가족·지인이 대신 요청했다면 반드시 본인이 다시 확인해주세요.
      </p>

      <button
        onClick={() => { if (selected) { setDone(selected); onIncreased(selected); } }}
        disabled={!selected}
        className="w-full py-4 rounded-xl text-[16px] font-bold text-white bg-[var(--ac-500)] disabled:opacity-40 active:scale-[0.98] transition-all"
      >
        한도 상향 신청
      </button>
    </div>
  );
}
