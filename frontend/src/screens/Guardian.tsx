// 안심동행 설정 화면 — 서비스 소개 → 역할 선택 → 페어링 코드 → 완료
//
// MVP 페어링: 부모 앱이 만든 1회용 코드를 자녀 앱에서 검증하면 양쪽에 연결 상태를 반영한다.

import { useEffect, useState } from "react";

type Step = "intro" | "select" | "code" | "done";

const DEMO_PAIR_CODE = "3827";
const PAIR_CODE_KEY = "ansimPairCode";
const PAIRED_KEY = "ansimPaired";
const PAIRED_EVENT = "ansim-paired";

const LAYERS = [
  { step: "1", title: "휴대폰부터 살펴봐요",         desc: "몰래 조종하거나 은행을 흉내 낸 앱이 깔려 있는지 확인해요" },
  { step: "2", title: "연락처가 진짜인지 확인해요",   desc: "받으신 번호·문자·링크가 기관의 공식 연락처와 같은지 대조해요" },
  { step: "3", title: "평소와 다른 움직임을 알아채요", desc: "잔액을 자꾸 확인하거나 적금을 깨는 등 낯선 흐름을 살펴요" },
  { step: "4", title: "송금 내용을 살펴봐요",         desc: "평소와 같으면 그대로 보내드리고, 다를 때만 한 번 더 확인해요" },
  { step: "5", title: "왜 보내시는지 여쭤봐요",       desc: "AI가 대화로 확인해요. 통화 중이시면 끊고 5분 뒤에 다시 안내해요" },
  { step: "6", title: "혼자 결정하지 않게 도와드려요", desc: "알림만 받을지 함께 승인할지, 보호 단계는 부모님이 직접 고르세요" },
  { step: "7", title: "피해를 입어도 되돌려요",       desc: "지급정지·신고·피해구제 절차를 순서대로 안내해드려요" },
];

const PROMISES = [
  { t: "자녀는 잔액과 거래내역을 볼 수 없어요", d: "어떤 단계를 고르셔도 통장 잔액, 어디에 쓰셨는지는 부모님만 보십니다" },
  { t: "위험한 순간의 상황만 전달돼요",         d: '"처음 보는 곳에 큰 금액을 보내려 하십니다" 정도만 자녀에게 알려요' },
  { t: "언제든 그만두실 수 있어요",             d: "보호 단계를 낮추거나 연결을 해제하는 것은 부모님 뜻대로예요" },
];

export default function Guardian({ onExit, appRole }: { onExit: () => void; appRole: "parent" | "child" }) {
  const [step, setStep] = useState<Step>("intro");
  const [pairRole, setPairRole] = useState<"parent" | "child" | null>(null);
  const [code, setCode] = useState(["", "", "", ""]);
  const [codeError, setCodeError] = useState("");
  const [isPaired, setIsPaired] = useState(() => localStorage.getItem(PAIRED_KEY) === "true");

  useEffect(() => {
    const syncPairing = () => {
      const paired = localStorage.getItem(PAIRED_KEY) === "true";
      setIsPaired(paired);
      if (paired && pairRole === "parent") setStep("done");
    };

    window.addEventListener(PAIRED_EVENT, syncPairing);
    window.addEventListener("storage", syncPairing);
    return () => {
      window.removeEventListener(PAIRED_EVENT, syncPairing);
      window.removeEventListener("storage", syncPairing);
    };
  }, [pairRole]);

  const selectRole = (role: "parent" | "child") => {
    setPairRole(role);
    setCode(["", "", "", ""]);
    setCodeError("");
    if (role === "parent") localStorage.setItem(PAIR_CODE_KEY, DEMO_PAIR_CODE);
    setStep("code");
  };

  const connectFamily = () => {
    const enteredCode = code.join("");
    const issuedCode = localStorage.getItem(PAIR_CODE_KEY);

    if (!issuedCode || enteredCode !== issuedCode) {
      setCodeError("연결 코드가 맞지 않아요. 부모님 앱의 코드를 다시 확인해주세요.");
      return;
    }

    localStorage.setItem(PAIRED_KEY, "true");
    localStorage.removeItem(PAIR_CODE_KEY);
    setIsPaired(true);
    setCodeError("");
    setStep("done");
    window.dispatchEvent(new Event(PAIRED_EVENT));
  };

  const disconnectFamily = () => {
    const target = appRole === "parent" ? "자녀와의 안심동행 연결" : "부모님과의 안심동행 연결";
    if (!window.confirm(`${target}을 해제할까요?\n해제 후에는 위험 거래 알림이 전달되지 않아요.`)) return;

    localStorage.removeItem(PAIRED_KEY);
    localStorage.removeItem(PAIR_CODE_KEY);
    setIsPaired(false);
    setPairRole(null);
    setStep("intro");
    window.dispatchEvent(new Event(PAIRED_EVENT));
  };

  const goBack = () => (step === "select" ? setStep("intro") : onExit());

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 py-2">
        <button onClick={goBack} className="text-gray-500 active:scale-90 transition-transform">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <p className="text-[17px] font-bold text-gray-900">안심동행 AI</p>
      </div>

      {/* 홈 광고 배너와 같은 톤 — 색은 theme-parent / theme-child 가 결정한다 */}
      <div className="bg-gradient-to-br from-[var(--ac-band-from)] via-[var(--ac-band-via)] to-[var(--ac-band-to)] border border-[var(--ac-band-border)] rounded-2xl p-4 flex items-center gap-4">
        <svg viewBox="0 0 48 48" fill="var(--ac-band-icon)" fillOpacity="0.9" className="w-14 h-14 shrink-0"><circle cx="14" cy="12" r="4.5" /><path d="M14 17c-4 0-7 3-7 7v6h14v-6c0-4-3-7-7-7z" /><circle cx="34" cy="12" r="4.5" /><path d="M34 17c-4 0-7 3-7 7v6h14v-6c0-4-3-7-7-7z" /><circle cx="24" cy="20" r="3.5" /><path d="M24 24c-3 0-5.5 2.5-5.5 5.5V36h11v-6.5c0-3-2.5-5.5-5.5-5.5z" /></svg>
        <div>
          <p className="text-[17px] font-bold text-[var(--ac-band-text)]">부모님 금융을 가족이 함께 지켜요</p>
          <p className="text-[12px] text-[var(--ac-band-sub)] mt-1">AI가 이상 거래를 감지하고 가족에게 알려드려요</p>
        </div>
      </div>

      {step === "intro" && isPaired && (
        <div className="flex flex-col gap-3">
          <div className="bg-white rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[12px] font-semibold text-[var(--ac-500)]">안심동행 연결 중</p>
                <p className="text-[18px] font-bold text-gray-900 mt-1">
                  {appRole === "parent" ? "딸 김지혜님" : "어머니 김영순님"}
                </p>
              </div>
              <span className="flex items-center gap-1.5 text-[12px] font-semibold text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-green-500" />연결됨
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[14px] font-bold text-gray-900">Lv.2 공동확인</p>
                <p className="text-[11px] text-gray-400 mt-1">현재 보호 단계</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[14px] font-bold text-gray-900">2026.08.15</p>
                <p className="text-[11px] text-gray-400 mt-1">연동일</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5">
            <p className="text-[14px] font-bold text-gray-900 mb-3">은행 간 연결 정보</p>
            <div className="flex items-center justify-between text-[13px]">
              <div><p className="font-semibold text-gray-900">김영순</p><p className="text-[11px] text-gray-400 mt-0.5">한결은행 · 부모</p></div>
              <span className="text-[var(--ac-500)] font-bold">연결</span>
              <div className="text-right"><p className="font-semibold text-gray-900">김지혜</p><p className="text-[11px] text-gray-400 mt-0.5">나눔은행 · 자녀</p></div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-start gap-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" className="w-4 h-4 shrink-0 mt-0.5"><path d="M20 6L9 17l-5-5" /></svg>
              <p className="text-[12px] text-gray-500">자녀에게는 잔액과 전체 거래내역을 공개하지 않고, 위험 상황에 필요한 최소 정보만 전달해요.</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[14px] font-bold text-gray-900">주간 안심 리포트</p>
              <p className="text-[11px] text-gray-400">08.09 ~ 08.15</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[["127건", "정상 거래", "text-gray-900"], ["1건", "위험 탐지", "text-red-500"], ["0건", "피해 발생", "text-green-600"]].map(([value, label, color]) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3">
                  <p className={`text-[17px] font-bold ${color}`}>{value}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <button className="w-full py-3.5 rounded-xl text-[14px] font-semibold text-gray-900 bg-white border border-gray-200 active:scale-[0.98] transition-all">
            보호 단계 및 권한 관리
          </button>
          <button onClick={disconnectFamily} className="w-full py-3.5 rounded-xl text-[14px] font-semibold text-red-500 bg-white border border-red-100 active:scale-[0.98] transition-all">
            {appRole === "parent" ? "자녀 연결 해제" : "부모님 연결 해제"}
          </button>
          <p className="text-[11px] text-gray-400 text-center -mt-1">
            연결을 해제해도 은행 계좌와 거래내역에는 영향을 주지 않아요.
          </p>
        </div>
      )}

      {step === "intro" && !isPaired && (
        <div className="flex flex-col gap-3">
          <div className="bg-white rounded-2xl p-5">
            <p className="text-[15px] font-bold text-gray-900">이렇게 지켜드려요</p>
            <p className="text-[12px] text-gray-400 mt-1 mb-4">송금할 때 이 순서로 위험을 살펴봐요</p>
            {LAYERS.map((item) => (
              <div key={item.step} className="flex items-start gap-3 mb-4 last:mb-0">
                <div className="w-7 h-7 rounded-full bg-[var(--ac-500)] text-white text-[13px] font-bold flex items-center justify-center shrink-0 mt-0.5">{item.step}</div>
                <div>
                  <p className="text-[14px] font-semibold text-gray-900">{item.title}</p>
                  <p className="text-[12px] text-gray-400 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
            <div className="mt-5 pt-4 border-t border-gray-100 flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-[var(--ac-50)] flex items-center justify-center shrink-0 mt-0.5">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--ac-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M12 2v20M2 12h20" /></svg>
              </div>
              <div>
                <p className="text-[14px] font-semibold text-gray-900">은행이 달라도 가족이 연결돼요</p>
                <p className="text-[12px] text-gray-400 mt-0.5">부모님과 자녀분이 서로 다른 은행을 쓰셔도 함께 지켜드려요</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--ac-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
              <p className="text-[15px] font-bold text-gray-900">이건 꼭 약속드려요</p>
            </div>
            {PROMISES.map((item) => (
              <div key={item.t} className="flex items-start gap-3 mb-4 last:mb-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] shrink-0 mt-0.5"><path d="M20 6L9 17l-5-5" /></svg>
                <div>
                  <p className="text-[14px] font-semibold text-gray-900">{item.t}</p>
                  <p className="text-[12px] text-gray-400 mt-0.5">{item.d}</p>
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => setStep("select")} className="w-full py-4 rounded-2xl text-[16px] font-semibold text-white bg-[var(--ac-500)] active:scale-[0.98] transition-all">
            시작하기
          </button>
        </div>
      )}

      {step === "select" && (
        <div className="flex flex-col gap-3">
          <p className="text-[15px] font-semibold text-gray-900 text-center mt-2">역할을 선택해주세요</p>
          {[
            { r: "parent" as const, label: "부모님", desc: "AI와 자녀에게 안심동행 권한을 위임해요" },
            { r: "child"  as const, label: "자녀",   desc: "부모님 금융을 함께 지켜드려요" },
          ].map((item) => (
            <button key={item.r} onClick={() => selectRole(item.r)}
              className="bg-white rounded-2xl p-5 flex items-center gap-4 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all">
              <div className="w-12 h-12 rounded-full bg-[var(--ac-50)] flex items-center justify-center">
                <svg viewBox="0 0 32 32" fill="var(--ac-500)" className="w-7 h-7"><circle cx="16" cy="10" r="5" /><path d="M16 16c-5 0-9 3.5-9 8v2h18v-2c0-4.5-4-8-9-8z" /></svg>
              </div>
              <div className="text-left">
                <p className="text-[16px] font-bold text-gray-900">{item.label}</p>
                <p className="text-[12px] text-gray-400">{item.desc}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {step === "code" && (
        <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-5">
          <p className="text-[15px] font-semibold text-gray-900">
            {pairRole === "parent" ? "자녀에게 이 코드를 알려주세요" : "부모님의 연동 코드를 입력하세요"}
          </p>
          {pairRole === "parent" ? (
            <div className="w-full rounded-2xl bg-[var(--ac-50)] py-6 text-center">
              <p className="text-[32px] font-bold text-gray-900 tracking-[0.32em] pl-[0.32em]">{DEMO_PAIR_CODE.split("").join(" ")}</p>
              <p className="mt-2 text-[12px] text-gray-500">자녀 앱에서 입력할 1회용 연결 코드예요</p>
            </div>
          ) : (
            <div className="flex gap-3">
              {code.map((digit, i) => (
                <input key={i} type="text" inputMode="numeric" maxLength={1} value={digit}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/, "");
                    const next = [...code]; next[i] = v; setCode(next);
                    setCodeError("");
                    if (v && i < 3) (e.target.nextElementSibling as HTMLInputElement | null)?.focus();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Backspace" && !code[i] && i > 0)
                      ((e.target as HTMLElement).previousElementSibling as HTMLInputElement | null)?.focus();
                  }}
                  className="w-14 h-14 text-center text-[24px] font-bold text-gray-900 border-2 border-gray-200 rounded-xl focus:border-[var(--ac-500)] focus:outline-none transition-colors" />
              ))}
            </div>
          )}
          {codeError && <p role="alert" className="text-[12px] text-red-500 text-center">{codeError}</p>}
          <button onClick={pairRole === "child" ? connectFamily : undefined} disabled={pairRole === "parent" || code.some((d) => !d)}
            className="w-full py-3 rounded-xl text-[15px] font-semibold text-white bg-[var(--ac-500)] active:scale-[0.98] transition-all disabled:bg-gray-200 disabled:text-gray-400">
            {pairRole === "parent" ? "자녀의 입력을 기다리는 중" : "연동하기"}
          </button>
          <button onClick={() => { setStep("select"); setCode(["", "", "", ""]); setCodeError(""); }} className="text-[13px] text-gray-400 active:scale-95">
            이전으로
          </button>
        </div>
      )}

      {step === "done" && (
        <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8"><path d="M20 6L9 17l-5-5" /></svg>
          </div>
          <p className="text-[17px] font-bold text-gray-900">연동 완료!</p>
          <p className="text-[13px] text-gray-400 text-center whitespace-pre-line">
            {pairRole === "parent"
              ? "딸 지혜님과 안심동행이 연결되었습니다.\n이제 AI가 이상 거래를 감지하면 자녀에게 알려드려요."
              : "어머니 김영순님과 안심동행이 연결되었습니다.\n부모님의 이상 거래를 함께 지켜볼 수 있어요."}
          </p>
          <button onClick={onExit} className="w-full py-3 rounded-xl text-[15px] font-semibold text-white bg-[var(--ac-500)] active:scale-[0.98] transition-all">
            홈으로 돌아가기
          </button>
        </div>
      )}
    </div>
  );
}
