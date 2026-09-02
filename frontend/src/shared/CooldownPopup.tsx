// 전역 송금 정지(쿨다운) 중 새 송금을 시도할 때 뜨는 팝업.
// 화면을 바꾸지 않고 그 자리에서 막는다 — "송금" 버튼을 누르는 즉시 뜬다.

export default function CooldownPopup({
  secondsLeft,
  onClose,
}: {
  secondsLeft: number;
  onClose: () => void;
}) {
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div
      className="fixed inset-0 z-[180] flex items-center justify-center bg-black/45 px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cooldown-popup-title"
    >
      <div className="w-full max-w-[340px] overflow-hidden rounded-[26px] border border-[var(--ac-100)] bg-white shadow-2xl">
        <div className="flex flex-col items-center gap-3 px-6 pt-7 pb-6 text-center">
          <img
            src="/ansim-ai-profile.png"
            alt="안심동행 AI"
            className="h-12 w-12 rounded-full border border-[var(--ac-100)] bg-white object-cover shadow-sm"
          />
          <p id="cooldown-popup-title" className="text-[16px] font-bold text-gray-900">송금이 일시 정지됐어요</p>
          <p className="text-[13px] leading-relaxed text-gray-500">
            위험 신호가 감지돼 안심동행 AI가 송금을 잠시 멈췄어요.
            <br />
            정지가 끝날 때까지 새 송금을 시작할 수 없어요.
          </p>
          <div className="mt-1 rounded-2xl bg-[var(--ac-50)] px-6 py-3 text-[32px] font-black tracking-[3px] text-[var(--ac-700)] font-mono">
            {mm}:{ss}
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-full border-t border-gray-100 py-4 text-[15px] font-bold text-[var(--ac-600)] active:scale-[0.98] transition-transform"
        >
          확인
        </button>
      </div>
    </div>
  );
}
