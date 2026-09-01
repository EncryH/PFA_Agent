import { useState } from "react";

export default function CallSafetyCheck({
  actionLabel,
  onClose,
  onProceed,
}: {
  actionLabel: string;
  onClose: () => void;
  onProceed: () => void;
}) {
  const [onCall, setOnCall] = useState(false);

  return (
    <div
      className="fixed inset-y-0 left-1/2 z-[120] flex w-full max-w-[430px] -translate-x-1/2 items-center justify-center bg-black/45 px-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="call-safety-title"
    >
      <div className="w-full rounded-[24px] bg-white p-5 shadow-2xl">
        {!onCall ? (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.86 19.86 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.86 19.86 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 id="call-safety-title" className="mt-4 text-[19px] font-black text-gray-900">
              혹시 지금 통화 중이신가요?
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-gray-600">
              통화 상대가 <strong>{actionLabel}</strong>을 요청했다면 보이스피싱일 수 있어요.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setOnCall(true)}
                className="rounded-xl border border-red-200 bg-red-50 py-3.5 text-[14px] font-bold text-red-700 active:scale-[0.98]"
              >
                예
              </button>
              <button
                type="button"
                onClick={onProceed}
                className="rounded-xl bg-[var(--ac-500)] py-3.5 text-[14px] font-bold text-white active:scale-[0.98]"
              >
                아니오
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </div>
            <h2 id="call-safety-title" className="mt-4 text-[19px] font-black text-red-700">
              통화를 먼저 끊어주세요
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-gray-700">
              검찰·경찰·금융기관은 전화로 자산을 옮기거나 이체한도를 높이라고 요구하지 않아요.
            </p>
            <div className="mt-4 rounded-xl bg-red-50 p-3.5 text-[12px] font-semibold leading-relaxed text-red-700">
              상대방이 알려준 번호가 아닌 공식 앱이나 대표번호로 직접 다시 확인하세요.
            </div>
            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-red-600 py-3.5 text-[14px] font-bold text-white active:scale-[0.98]"
              >
                지금은 중단하기
              </button>
              <button
                type="button"
                onClick={onProceed}
                className="rounded-xl border border-gray-200 bg-white py-3 text-[12px] font-semibold text-gray-500 active:scale-[0.98]"
              >
                통화를 끊었어요 · 계속하기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
