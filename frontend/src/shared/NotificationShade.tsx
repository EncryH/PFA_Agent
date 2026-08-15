import { useCallback, useEffect, useRef, useState } from "react";

type NotificationShadeProps = {
  role: "parent" | "child";
  hasRiskAlert?: boolean;
  onClose: () => void;
  onOpenRiskAlert?: () => void;
};

export default function NotificationShade({ role, hasRiskAlert = false, onClose, onOpenRiskAlert }: NotificationShadeProps) {
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const closeTimer = useRef<number | null>(null);

  const requestClose = useCallback((afterClose = onClose) => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    closeTimer.current = window.setTimeout(afterClose, 260);
  }, [onClose]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && requestClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, [requestClose]);

  const now = new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());

  return (
    <div className="fixed inset-0 z-[100] flex justify-center" role="dialog" aria-label="알림창" aria-modal="true">
      <button aria-label="알림창 닫기" onClick={() => requestClose()} className={`absolute inset-0 bg-black/30 ${closing ? "notification-backdrop-out" : "notification-backdrop"}`} />
      <section className={`${closing ? "notification-shade-out" : "notification-shade"} relative flex h-dvh max-h-dvh w-full max-w-[430px] flex-col self-start overflow-hidden bg-[#f4f6fa]/95 px-4 pb-4 pt-3 shadow-2xl backdrop-blur-xl`}>
        <div className="mb-4 flex items-center justify-between px-1 text-[12px] font-semibold text-gray-700">
          <span>{now}</span>
          <div className="flex items-center gap-2">
            <span>5G</span>
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M2 8.8a15.8 15.8 0 0120 0l-1.7 2.1a13.1 13.1 0 00-16.6 0L2 8.8zm3.4 4.1a10.4 10.4 0 0113.2 0L16.9 15a7.7 7.7 0 00-9.8 0l-1.7-2.1zm3.5 4.2a4.9 4.9 0 016.2 0L12 21l-3.1-3.9z" /></svg>
            <span className="h-3.5 w-6 rounded-[3px] border border-gray-700 p-[1px]"><span className="block h-full w-4 rounded-[1px] bg-gray-700" /></span>
          </div>
        </div>

        <div className="mb-3 px-1">
          <div><p className="text-[27px] font-bold tracking-tight text-gray-900">알림</p><p className="text-[12px] text-gray-500">오늘</p></div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain pb-6">
          {role === "child" && hasRiskAlert && (
            <button onClick={() => requestClose(onOpenRiskAlert ?? onClose)} className="w-full rounded-2xl border border-red-100 bg-white/95 p-4 text-left shadow-sm active:scale-[0.98] transition-transform">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500 text-[18px] text-white">!</span>
                <div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><p className="text-[13px] font-bold text-gray-900">안심동행 AI</p><span className="text-[10px] text-gray-400">지금</span></div><p className="mt-1 text-[13px] font-semibold text-red-600">어머니의 위험 송금을 확인해주세요</p><p className="mt-0.5 text-[12px] text-gray-500">평소와 다른 300만원 송금이 잠시 보류됐어요.</p></div>
              </div>
            </button>
          )}

          <div className="rounded-2xl bg-white/95 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[16px] font-bold text-white ${role === "parent" ? "bg-blue-500" : "bg-emerald-500"}`}>은</span>
              <div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><p className="text-[13px] font-bold text-gray-900">{role === "parent" ? "한결은행" : "나눔은행"}</p><span className="text-[10px] text-gray-400">10분 전</span></div><p className="mt-1 text-[12px] text-gray-600">로그인과 계좌 상태가 안전하게 확인됐어요.</p></div>
            </div>
          </div>

          <div className="rounded-2xl bg-white/95 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500 text-[16px] font-bold text-white">AI</span>
              <div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><p className="text-[13px] font-bold text-gray-900">안심동행 AI</p><span className="text-[10px] text-gray-400">어제</span></div><p className="mt-1 text-[12px] text-gray-600">이번 주 금융 보호 리포트가 도착했어요.</p></div>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-gray-200/70 pt-3">
          <button aria-label="알림창 닫기" onClick={() => requestClose()} className="mx-auto block h-1.5 w-28 rounded-full bg-gray-400/70" />
          <p className="mt-2 text-center text-[11px] text-gray-400">아래 막대를 누르면 닫혀요</p>
        </div>
      </section>
    </div>
  );
}
