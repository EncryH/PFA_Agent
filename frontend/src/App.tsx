import { useState } from "react";

const tabs = ["홈", "금융", "상품", "혜택", "주식"] as const;

const icons: Record<(typeof tabs)[number], React.ReactNode> = {
  홈: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
      <path d="M12 3C11.4 3 10.8 3.3 10.4 3.7L3.7 9.5C3.3 9.9 3 10.5 3 11.1V19c0 1.1.9 2 2 2h4.5v-6h5v6H19c1.1 0 2-.9 2-2v-7.9c0-.6-.3-1.2-.7-1.6l-6.7-5.8C13.2 3.3 12.6 3 12 3z" />
    </svg>
  ),
  금융: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
      <rect x="2" y="5" width="20" height="14" rx="2.5" />
      <rect x="2" y="9" width="20" height="3" fill="white" fillOpacity="0.3" />
      <circle cx="6" cy="15.5" r="1.5" fill="white" fillOpacity="0.5" />
      <text x="17" y="16.5" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold">₩</text>
    </svg>
  ),
  상품: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
      <path d="M4.5 8l1.5 12h12L19.5 8H4.5z" />
      <path d="M9 8V6a3 3 0 016 0v2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  혜택: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
      <rect x="3" y="10" width="18" height="3" rx="1" />
      <path d="M5 13v7c0 .6.4 1 1 1h12c.6 0 1-.4 1-1v-7" fillOpacity="0.3" />
      <rect x="11" y="10" width="2" height="11" />
      <path d="M12 10c-1-3-4-4-5-3s0 3.5 5 3c5 .5 6-2 5-3s-4 0-5 3" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  주식: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
      <rect x="4" y="14" width="3" height="7" rx="0.5" fillOpacity="0.4" />
      <rect x="8.5" y="11" width="3" height="10" rx="0.5" fillOpacity="0.6" />
      <rect x="13" y="8" width="3" height="13" rx="0.5" fillOpacity="0.8" />
      <rect x="17.5" y="5" width="3" height="16" rx="0.5" />
      <path d="M5 12L9.5 9 14 6.5 19 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.5 3L19.5 3.5L19 6.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

export default function App() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("홈");
  const [page, setPage] = useState<"home" | "guardian">("home");
  const [guardianStep, setGuardianStep] = useState<"select" | "code" | "done">("select");
  const [guardianRole, setGuardianRole] = useState<"parent" | "child" | null>(null);
  const [code, setCode] = useState(["", "", "", ""]);

  return (
    <div className="mx-auto min-h-dvh max-w-[430px] bg-[#fafbfe] flex flex-col">
      <header className="flex items-center justify-between px-5 py-4">
        <button onClick={() => { setTab("홈"); setPage("home"); }} className="flex items-center gap-1.5 active:scale-95 transition-transform">
          <svg viewBox="0 0 24 24" fill="#2563eb" className="w-5 h-5">
            <path d="M12 2L2 7.5v1h20v-1L12 2z" />
            <path d="M4.5 9h2v8h-2zM9 9h2v8H9zM13 9h2v8h-2zM17.5 9h2v8h-2z" />
            <path d="M2 17h20v2H2z" />
            <circle cx="12" cy="5.2" r="0.8" fill="white" />
          </svg>
          <span className="text-[17px] font-bold text-blue-600 tracking-tight">안심은행</span>
        </button>
        <div className="flex gap-3">
        <button className="text-gray-500 active:scale-90 transition-transform">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </button>
        <button className="text-gray-500 active:scale-90 transition-transform">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
            <path d="M12 2a1.5 1.5 0 011.5 1.5v.3A6 6 0 0118 9.5c0 3.5 1 5.5 2 7 .3.4 0 1-.5 1H4.5c-.5 0-.8-.6-.5-1 1-1.5 2-3.5 2-7a6 6 0 014.5-5.7v-.3A1.5 1.5 0 0112 2z" />
            <path d="M9.5 17.5a2.5 2.5 0 005 0" />
          </svg>
        </button>
        <button className="text-gray-500 active:scale-90 transition-transform">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
            <rect x="3" y="5" width="18" height="2" rx="1" />
            <rect x="3" y="11" width="18" height="2" rx="1" />
            <rect x="3" y="17" width="18" height="2" rx="1" />
          </svg>
        </button>
        </div>
      </header>

      <main className="flex-1 px-3">
        {page === "guardian" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 py-2">
              <button onClick={() => setPage("home")} className="text-gray-500 active:scale-90 transition-transform">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <p className="text-[17px] font-bold text-gray-900">안심동행 AI</p>
            </div>
            <div className="bg-gradient-to-br from-blue-700 via-blue-500 to-cyan-400 rounded-2xl p-4 flex items-center gap-4">
              <svg viewBox="0 0 48 48" fill="white" fillOpacity="0.9" className="w-14 h-14 shrink-0">
                <circle cx="14" cy="12" r="4.5" />
                <path d="M14 17c-4 0-7 3-7 7v6h14v-6c0-4-3-7-7-7z" />
                <circle cx="34" cy="12" r="4.5" />
                <path d="M34 17c-4 0-7 3-7 7v6h14v-6c0-4-3-7-7-7z" />
                <circle cx="24" cy="20" r="3.5" />
                <path d="M24 24c-3 0-5.5 2.5-5.5 5.5V36h11v-6.5c0-3-2.5-5.5-5.5-5.5z" />
              </svg>
              <div>
                <p className="text-[17px] font-bold text-white">부모님 금융을 가족이 함께 지켜요</p>
                <p className="text-[12px] text-blue-100 mt-1">AI가 이상 거래를 감지하고 가족에게 알려드려요</p>
              </div>
            </div>
            {guardianStep === "select" && (
              <div className="flex flex-col gap-3">
                <div className="bg-white rounded-2xl p-5">
                  <p className="text-[15px] font-bold text-gray-900 mb-4">이렇게 지켜드려요</p>
                  {[
                    { step: "1", title: "AI가 거래를 분석해요", desc: "송금할 때 AI가 상대방과 거래 패턴을 실시간 확인" },
                    { step: "2", title: "위험하면 대화로 확인해요", desc: "의심 거래 감지 시 부모님께 부드럽게 한 번 더 여쭤봐요" },
                    { step: "3", title: "가족에게 알려드려요", desc: "위험도가 높으면 자녀에게 알림을 보내 함께 판단해요" },
                  ].map((item) => (
                    <div key={item.step} className="flex items-start gap-3 mb-4 last:mb-0">
                      <div className="w-7 h-7 rounded-full bg-blue-500 text-white text-[13px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {item.step}
                      </div>
                      <div>
                        <p className="text-[14px] font-semibold text-gray-900">{item.title}</p>
                        <p className="text-[12px] text-gray-400 mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[15px] font-semibold text-gray-900 text-center">역할을 선택해주세요</p>
                <button
                  onClick={() => { setGuardianRole("parent"); setGuardianStep("code"); }}
                  className="bg-white rounded-2xl p-5 flex items-center gap-4 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200"
                >
                  <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
                    <svg viewBox="0 0 32 32" fill="#3b82f6" className="w-7 h-7">
                      <circle cx="16" cy="10" r="5" />
                      <path d="M16 16c-5 0-9 3.5-9 8v2h18v-2c0-4.5-4-8-9-8z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-[16px] font-bold text-gray-900">부모님</p>
                    <p className="text-[12px] text-gray-400">AI와 자녀에게 안심동행 권한을 위임해요</p>
                  </div>
                </button>
                <button
                  onClick={() => { setGuardianRole("child"); setGuardianStep("code"); }}
                  className="bg-white rounded-2xl p-5 flex items-center gap-4 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200"
                >
                  <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
                    <svg viewBox="0 0 32 32" fill="#3b82f6" className="w-7 h-7">
                      <circle cx="16" cy="10" r="5" />
                      <path d="M16 16c-5 0-9 3.5-9 8v2h18v-2c0-4.5-4-8-9-8z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-[16px] font-bold text-gray-900">자녀</p>
                    <p className="text-[12px] text-gray-400">부모님 금융을 함께 지켜드려요</p>
                  </div>
                </button>
              </div>
            )}
            {guardianStep === "code" && (
              <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-5">
                <p className="text-[15px] font-semibold text-gray-900">
                  {guardianRole === "parent" ? "자녀에게 이 코드를 알려주세요" : "부모님의 연동 코드를 입력하세요"}
                </p>
                <div className="flex gap-3">
                  {code.map((digit, i) => (
                    <input
                      key={i}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/, "");
                        const next = [...code];
                        next[i] = v;
                        setCode(next);
                        if (v && i < 3) {
                          const el = e.target.nextElementSibling as HTMLInputElement | null;
                          el?.focus();
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Backspace" && !code[i] && i > 0) {
                          const el = (e.target as HTMLElement).previousElementSibling as HTMLInputElement | null;
                          el?.focus();
                        }
                      }}
                      className="w-14 h-14 text-center text-[24px] font-bold text-gray-900 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                    />
                  ))}
                </div>
                {guardianRole === "parent" && (
                  <p className="text-[28px] font-bold text-blue-600 tracking-[0.3em]">3 8 2 7</p>
                )}
                <button
                  onClick={() => setGuardianStep("done")}
                  disabled={guardianRole === "child" && code.some((d) => !d)}
                  className="w-full py-3 rounded-xl text-[15px] font-semibold text-white bg-blue-500 hover:bg-blue-600 active:scale-[0.98] transition-all duration-200 disabled:bg-gray-200 disabled:text-gray-400"
                >
                  {guardianRole === "parent" ? "다음" : "연동하기"}
                </button>
                <button
                  onClick={() => { setGuardianStep("select"); setCode(["", "", "", ""]); }}
                  className="text-[13px] text-gray-400 active:scale-95 transition-transform"
                >
                  이전으로
                </button>
              </div>
            )}
            {guardianStep === "done" && (
              <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <p className="text-[17px] font-bold text-gray-900">연동 완료!</p>
                <p className="text-[13px] text-gray-400 text-center">
                  {guardianRole === "parent"
                    ? "딸 지혜님과 안심동행이 연결되었습니다.\n이제 AI가 이상 거래를 감지하면 자녀에게 알려드려요."
                    : "어머니 김영순님과 안심동행이 연결되었습니다.\n부모님의 이상 거래를 함께 지켜볼 수 있어요."}
                </p>
                <button
                  onClick={() => { setPage("home"); setGuardianStep("select"); setCode(["", "", "", ""]); }}
                  className="w-full py-3 rounded-xl text-[15px] font-semibold text-white bg-blue-500 hover:bg-blue-600 active:scale-[0.98] transition-all duration-200"
                >
                  홈으로 돌아가기
                </button>
              </div>
            )}
          </div>
        )}
        {page === "home" && tab === "홈" && (
          <>
          <div className="bg-white rounded-2xl p-5 flex flex-col gap-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
            {[
              { name: "안심은행 입출금통장", balance: "1,250,000", icon: (
                <svg viewBox="0 0 24 24" fill="#2563eb" className="w-4 h-4">
                  <path d="M12 2L2 7.5v1h20v-1L12 2z" />
                  <path d="M4.5 9h2v8h-2zM9 9h2v8H9zM13 9h2v8h-2zM17.5 9h2v8h-2z" />
                  <path d="M2 17h20v2H2z" />
                </svg>
              )},
              { name: "토스뱅크 통장", balance: "5,000,000", icon: (
                <svg viewBox="0 0 24 24" className="w-4 h-4">
                  <path d="M5 12h14M12 5v14" strokeWidth="3" stroke="#3182f6" fill="none" strokeLinecap="round" />
                </svg>
              )},
              { name: "신한 SOL 통장", balance: "320,000", icon: (
                <svg viewBox="0 0 24 24" className="w-4 h-4">
                  <text x="12" y="17" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#0046ff">S</text>
                </svg>
              )},
            ].map((acc) => (
              <div key={acc.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center bg-white border border-gray-200">
                    {acc.icon}
                  </div>
                  <div>
                    <p className="text-[13px] text-gray-500">{acc.name}</p>
                    <p className="text-[18px] font-bold text-gray-900">{acc.balance}원</p>
                  </div>
                </div>
                <button className="text-[13px] text-blue-500 bg-blue-50 rounded-md px-4 py-1.5 font-medium active:scale-95 hover:bg-blue-100 transition-all duration-200">
                  송금
                </button>
              </div>
            ))}
            <button className="text-[13px] text-gray-400 text-center pt-2 border-t border-gray-100 active:scale-95 transition-transform">
              모두보기
            </button>
          </div>
          <div className="bg-white rounded-2xl p-5 mt-3 flex items-center justify-between hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
            <div>
              <p className="text-[18px] font-bold text-gray-900">0원</p>
              <p className="text-[13px] text-gray-400">9월 이용 금액</p>
            </div>
            <button className="text-[13px] text-gray-500 bg-gray-100 rounded-md px-4 py-1.5 font-medium active:scale-95 hover:bg-gray-200 transition-all duration-200">
              내역
            </button>
          </div>
          <div onClick={() => setPage("guardian")} className="mt-3 rounded-2xl p-6 bg-gradient-to-br from-blue-700 via-blue-500 to-cyan-400 flex items-center justify-between active:scale-[0.98] hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer">
            <div>
              <p className="text-[14px] font-semibold text-white mb-1">안심동행 AI</p>
              <p className="text-[20px] text-blue-100 leading-snug">부모님 금융을<br/>가족이 함께 지켜요</p>
              <p className="text-[12px] text-blue-100 mt-2">시작하기 &gt;</p>
            </div>
            <svg viewBox="0 0 48 48" fill="white" fillOpacity="0.9" className="w-28 h-28">
              <circle cx="14" cy="12" r="4.5" />
              <path d="M14 17c-4 0-7 3-7 7v6h14v-6c0-4-3-7-7-7z" />
              <circle cx="34" cy="12" r="4.5" />
              <path d="M34 17c-4 0-7 3-7 7v6h14v-6c0-4-3-7-7-7z" />
              <circle cx="24" cy="20" r="3.5" />
              <path d="M24 24c-3 0-5.5 2.5-5.5 5.5V36h11v-6.5c0-3-2.5-5.5-5.5-5.5z" />
            </svg>
          </div>
          <div className="mt-3 bg-white rounded-2xl p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
            <p className="text-[14px] font-bold text-gray-900 mb-3">안심동행 현황</p>
            <div className="flex justify-around text-center">
            <div>
              <p className="text-[18px] font-bold text-blue-600">127건</p>
              <p className="text-[11px] text-gray-400 mt-0.5">오늘 보호된 거래</p>
            </div>
            <div className="w-px bg-gray-100" />
            <div>
              <p className="text-[18px] font-bold text-blue-600">99.2%</p>
              <p className="text-[11px] text-gray-400 mt-0.5">사기 탐지율</p>
            </div>
            <div className="w-px bg-gray-100" />
            <div>
              <p className="text-[18px] font-bold text-blue-600">1.2초</p>
              <p className="text-[11px] text-gray-400 mt-0.5">평균 분석 속도</p>
            </div>
            </div>
          </div>
          <div className="mt-3 bg-white rounded-2xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
            <p className="text-[16px] font-bold text-gray-900 mb-4">금융상품</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { title: "안심 정기예금", desc: "연 3.5% · 12개월" },
                { title: "내일채움 적금", desc: "월 30만원부터" },
                { title: "안심 신용대출", desc: "최저 연 4.2%" },
                { title: "주택청약종합저축", desc: "비과세 · 소득공제" },
              ].map((p) => (
                <button key={p.title} className="bg-blue-50/60 rounded-xl p-4 text-left active:scale-95 hover:bg-blue-100/60 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
                  <p className="text-[14px] font-semibold text-blue-400">{p.title}</p>
                  <p className="text-[12px] text-gray-400 mt-1">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 bg-white rounded-2xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
            <p className="text-[16px] font-bold text-gray-900 mb-4">추천서비스</p>
            {[
              { title: "마이데이터", desc: "내 자산을 한눈에 관리하세요" },
              { title: "안심 보험진단", desc: "가입 중인 보험 무료 분석" },
              { title: "신용점수 조회", desc: "무료로 내 신용점수 확인" },
            ].map((s) => (
              <button key={s.title} className="flex items-center justify-between w-full py-3 border-b border-gray-50 last:border-0 active:bg-gray-50 hover:bg-gray-50 transition-all duration-200">
                <div className="text-left">
                  <p className="text-[14px] font-medium text-gray-900">{s.title}</p>
                  <p className="text-[12px] text-gray-400 mt-0.5">{s.desc}</p>
                </div>
                <span className="text-gray-300 text-[14px]">&gt;</span>
              </button>
            ))}
          </div>
          </>
        )}
      </main>

      <nav className="sticky bottom-0 bg-white rounded-[28px] flex justify-around py-2 pt-3 mt-4">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex flex-col items-center gap-1 text-[11px] py-1 px-3 ${
              tab === t ? "text-blue-500 font-semibold" : "text-gray-400"
            }`}
          >
            {icons[t]}
            {t}
          </button>
        ))}
      </nav>
    </div>
  );
}
