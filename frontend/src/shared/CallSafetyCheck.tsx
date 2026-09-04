import { useState } from "react";

export default function CallSafetyCheck({
  actionLabel,
  onClose,
  onProceed,
  isOnCall = false,
  keywordDetected = false,
  keywordPhrase = "이체한도를 올려달라",
  closingGuidance = "검찰·경찰·금융기관은 전화로 자산을 옮기거나 이체한도를 높이라고 요구하지 않아요. 상대방이 알려준 번호가 아닌 공식 앱이나 대표번호로 직접 다시 확인하세요.",
}: {
  actionLabel: string;
  onClose: () => void;
  onProceed: () => void;
  // 실제 통화 배너 상태로 이미 통화 중임을 감지했다면, 굳이 자기 신고로 다시 묻지 않고
  // 바로 경고 화면으로 보낸다. 감지가 안 됐을 때만(false) 기존처럼 직접 물어본다.
  isOnCall?: boolean;
  // 통화 대사 자막에서 이 행동과 직접 관련된 요구(예: "이체한도를 올려라")가 감지됐는지.
  // isOnCall보다 더 구체적이고 확실한 신호라 경고 문구를 다르게 보여준다.
  keywordDetected?: boolean;
  // keywordDetected일 때 인용할 문구 — 화면마다 감지하는 요구가 다르다(이체한도 상향/적금 해지 등).
  keywordPhrase?: string;
  // 경고 화면 맨 아래 안내 문구 — 시나리오마다 사칭 대상이 달라서(세무사/법원/카드사/
  // 대출상담사/납치범) "검찰·경찰·금융기관은..." 하나로는 안 맞는 경우가 있어 시나리오별로
  // 다르게 넘긴다. 시나리오를 특정할 수 없을 때만 기본 문구를 쓴다.
  closingGuidance?: string;
}) {
  const [onCall, setOnCall] = useState(isOnCall || keywordDetected);

  return (
    <div
      className="fixed inset-y-0 left-1/2 z-[120] flex w-full max-w-[430px] -translate-x-1/2 items-center justify-center bg-black/45 px-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="call-safety-title"
    >
      <div className="w-full overflow-hidden rounded-[26px] border border-[var(--ac-100)] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--ac-100)] bg-gradient-to-r from-[var(--ac-50)] to-white px-5 py-4">
          <div className="flex items-center gap-2.5">
            <img
              src="/ansim-ai-profile.png"
              alt="안심동행 AI"
              className="h-10 w-10 rounded-full border border-[var(--ac-100)] bg-white object-cover shadow-sm"
            />
            <div>
              <p className="flex items-center gap-1.5 text-[12px] font-extrabold text-[var(--ac-700)]">
                <span className="h-2 w-2 rounded-full bg-[var(--ac-500)]" />
                안심동행 AI 행동 감지
              </p>
              <p className="mt-0.5 text-[10px] text-gray-500">금융 행동을 안전하게 확인하고 있어요</p>
            </div>
          </div>
          <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-700">
            위험 행동 감지
          </span>
        </div>

        <div className="p-5">
        {!onCall ? (
          <>
            <div className="rounded-xl border border-[var(--ac-100)] bg-[var(--ac-50)] px-4 py-3">
              <p className="text-[10px] font-bold text-[var(--ac-500)]">탐지된 행동</p>
              <p className="mt-1 text-[14px] font-extrabold text-[var(--ac-700)]">{actionLabel} 실행</p>
            </div>
            <h2 id="call-safety-title" className="mt-4 text-[19px] font-black text-gray-900">
              안전을 위해 한 번 더 확인할게요
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-gray-600">
              혹시 지금 누군가와 <strong>통화 중이신가요?</strong><br />
              통화 상대가 이 행동을 요청했다면 보이스피싱일 수 있어요.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setOnCall(true)}
                className="rounded-xl border border-red-200 bg-red-50 py-3.5 text-[14px] font-bold text-red-700 active:scale-[0.98]"
              >
                예, 통화 중이에요
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
            {/* isOnCall이면 "지금 통화 중"이라 끊으라고 해야 맞고, 통화가 이미 끝난 뒤에
                10분 창 안에서만 keywordDetected로 걸린 거라면 끊을 통화 자체가 없다 —
                이 둘을 구분 안 하면 통화가 끝났는데도 "통화를 먼저 끊어주세요"가 떠서
                뭘 끊으라는 건지 알 수 없는 화면이 됐다. */}
            <h2 id="call-safety-title" className="mt-4 text-[19px] font-black text-red-700">
              {isOnCall ? "통화를 먼저 끊어주세요" : "방금 통화가 의심돼요"}
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-gray-700">
              {keywordDetected ? (
                <>
                  {isOnCall ? "지금 통화 중에" : "방금 끝난 통화에서"} <strong>"{keywordPhrase}"</strong>는 말이 있었어요.
                  <br />
                  이건 전형적인 보이스피싱 수법이에요.
                </>
              ) : (
                isOnCall && (
                  <>
                    지금 <strong>통화 중인 것으로 확인됐어요.</strong> 전화 통화 중에 이런 행동을 하는 건 위험성이 높아요.
                  </>
                )
              )}
            </p>
            <div className="mt-4 rounded-xl bg-red-50 p-3.5 text-[12px] font-semibold leading-relaxed text-red-700">
              {closingGuidance}
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
                {isOnCall ? "통화를 끊었어요 · 계속하기" : "확인했어요 · 계속하기"}
              </button>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}
