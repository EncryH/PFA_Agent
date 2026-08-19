// 화면 여러 곳에서 쓰는 표시 요소 모음.

// 은행 브랜드 컬러 — 계좌 리스트 아바타에 사용
export const BANK_COLOR: Record<string, string> = {
  한결은행:   "#2563eb",   // 데모용 가상 은행 — 부모 앱
  나눔은행:   "#0f7a56",   // 데모용 가상 은행 — 자녀 앱 (다른 은행임을 색으로 구분)
  국민은행:   "#FFB600",
  신한은행:   "#0046FF",
  우리은행:   "#0067AC",
  하나은행:   "#008485",
  농협:       "#00A54F",
  기업은행:   "#0056A8",
  카카오뱅크: "#FFCD00",
  토스뱅크:   "#3182F6",
  케이뱅크:   "#3C4A9E",
  산업은행:   "#4A6E9E",
  수협:       "#3D8FA8",
  우체국:     "#C4544C",
  새마을금고: "#4A7BA8",
  신협:       "#4A8FB8",

  // 증권사 — 채도를 낮춰 은행 목록과 톤을 맞춘다
  미래에셋증권:   "#E8722A",
  삼성증권:       "#2B4A9B",
  NH투자증권:     "#3D9A6B",
  키움증권:       "#B94A5A",
  한국투자증권:   "#C4563C",
  KB증권:         "#D9A32B",
  신한투자증권:   "#3D5A9E",
  하나증권:       "#3D8080",
  대신증권:       "#3A5580",
  메리츠증권:     "#C4544C",
  교보증권:       "#3D6B4A",
  유안타증권:     "#4A7BB8",
  신영증권:       "#3D6B3D",
  현대차증권:     "#4A6E9E",
  한화투자증권:   "#D9873D",
  DB금융투자:     "#3D6BA8",
};

/** 자주 쓰는 수취인 아이콘 — 이름만 읽어도 무엇인지 알 수 있게. 색은 채도를 낮춰 은은하게 */
export const RECIPIENT_ICONS: Record<string, React.ReactNode> = {
  // 사람 (가족) — 부드러운 자주
  "딸 지혜": (
    <svg viewBox="0 0 24 24" fill="#B58BC4" className="w-full h-full"><circle cx="12" cy="7.5" r="4" /><path d="M12 13.5c-4.2 0-7.5 2.6-7.5 5.8V21h15v-1.7c0-3.2-3.3-5.8-7.5-5.8z" /></svg>
  ),
  // 상점 (차양 + 출입문) — 부드러운 주황
  "시장 상회": (
    <svg viewBox="0 0 24 24" fill="#D9A05B" className="w-full h-full"><path d="M4 3h16l2.2 5.2c.2.5-.2 1.1-.8 1.1H2.6c-.6 0-1-.6-.8-1.1L4 3z" /><path d="M4 11h16v9a1 1 0 01-1 1h-5v-6h-4v6H5a1 1 0 01-1-1v-9z" /></svg>
  ),
  // 아파트 (창문은 뚫린 구멍 — evenodd) — 부드러운 파랑
  "아파트 관리비": (
    <svg viewBox="0 0 24 24" fill="#7FA3C9" fillRule="evenodd" className="w-full h-full"><path d="M2.5 2.5h12v19h-12v-19zm2.5 3h2.5v2.5H5V5.5zm5 0h2.5v2.5H10V5.5zm-5 4.5h2.5v2.5H5V10zm5 0h2.5v2.5H10V10zm-5 4.5h2.5V17H5v-2.5zm5 0h2.5V17H10v-2.5zM16.5 9.5h5v12h-5v-12zm1.5 2.5h2v2.5h-2V12zm0 4.5h2V19h-2v-2.5z" /></svg>
  ),
  // 약국 (십자) — 부드러운 초록
  "약국": (
    <svg viewBox="0 0 24 24" fill="#6FB58A" className="w-full h-full"><path d="M9.2 2.5h5.6v6.7h6.7v5.6h-6.7v6.7H9.2v-6.7H2.5V9.2h6.7V2.5z" /></svg>
  ),
};

/** 은행 로고 — 홈 화면과 송금 화면 '내 계좌'가 함께 쓴다 */
export const BANK_LOGOS: Record<string, React.ReactNode> = {
  한결은행: <svg viewBox="0 0 24 24" fill="#2563eb" className="w-full h-full"><path d="M12 2L2 7.5v1h20v-1L12 2z" /><path d="M4.5 9h2v8h-2zM9 9h2v8H9zM13 9h2v8h-2zM17.5 9h2v8h-2z" /><path d="M2 17h20v2H2z" /></svg>,
  나눔은행: <svg viewBox="0 0 24 24" fill="#0f7a56" className="w-full h-full"><path d="M12 2L2 7.5v1h20v-1L12 2z" /><path d="M4.5 9h2v8h-2zM9 9h2v8H9zM13 9h2v8h-2zM17.5 9h2v8h-2z" /><path d="M2 17h20v2H2z" /></svg>,
  토스뱅크: <svg viewBox="0 0 24 24" className="w-full h-full"><path d="M5 12h14M12 5v14" strokeWidth="3" stroke="#3182f6" fill="none" strokeLinecap="round" /></svg>,
  신한은행: <svg viewBox="0 0 24 24" className="w-full h-full"><text x="12" y="17" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#0046ff">S</text></svg>,
};

/** 은행 로고를 흰 원 안에 담은 배지 */
export const BankLogo = ({ bank, size = 30 }: { bank: string; size?: number }) => (
  <div
    className="rounded-full flex items-center justify-center shrink-0 bg-white border border-gray-200"
    style={{ width: size, height: size }}
  >
    <span style={{ width: size * 0.55, height: size * 0.55, display: "block" }}>{BANK_LOGOS[bank]}</span>
  </div>
);

/**
 * 원형 아바타 — 두 가지 모드
 * - icon (수취인 목록)   : 흰 배경 + 옅은 테두리 + 각자 색을 가진 아이콘. 내 계좌의 은행 로고와 같은 형태
 * - icon 없음 (은행 선택) : 은행 브랜드 컬러 — 어느 은행인지 색으로 구분해야 하므로
 */
export const BankAvatar = ({ bank, name, size = 44, icon, label }: { bank: string; name: string; size?: number; icon?: React.ReactNode; label?: string }) =>
  icon ? (
    <div
      className="rounded-full flex items-center justify-center shrink-0 bg-white border border-gray-200"
      style={{ width: size, height: size }}
    >
      <span style={{ width: size * 0.55, height: size * 0.55, display: "block" }}>{icon}</span>
    </div>
  ) : (
    <div
      className="rounded-full flex items-center justify-center shrink-0 font-bold"
      style={{
        width: size,
        height: size,
        background: BANK_COLOR[bank] || "#94a3b8",
        fontSize: size * 0.38,
        // 카카오뱅크 노랑 계열은 흰 글씨가 안 보인다
        color: bank === "카카오뱅크" || bank === "국민은행" ? "#3d2b00" : "#fff",
      }}
    >
      {label ?? name.slice(-1)}
    </div>
  );

/** "국민은행" → "국민", "NH투자증권" → "NH", "DB금융투자" → "DB" — 목록 표시용 */
export const shortBank = (bank: string) => bank.replace(/은행|뱅크|투자증권|금융투자|증권/g, "") || bank;

export const parentTabs = ["홈", "금융", "상품", "혜택", "주식"] as const;
export const childTabs  = ["홈", "알림", "설정"] as const;

export const parentIcons: Record<string, React.ReactNode> = {
  홈:   <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M12 3C11.4 3 10.8 3.3 10.4 3.7L3.7 9.5C3.3 9.9 3 10.5 3 11.1V19c0 1.1.9 2 2 2h4.5v-6h5v6H19c1.1 0 2-.9 2-2v-7.9c0-.6-.3-1.2-.7-1.6l-6.7-5.8C13.2 3.3 12.6 3 12 3z" /></svg>,
  금융: <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><rect x="2" y="5" width="20" height="14" rx="2.5" /><rect x="2" y="9" width="20" height="3" fill="white" fillOpacity="0.3" /><circle cx="6" cy="15.5" r="1.5" fill="white" fillOpacity="0.5" /></svg>,
  상품: <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M4.5 8l1.5 12h12L19.5 8H4.5z" /><path d="M9 8V6a3 3 0 016 0v2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>,
  혜택: <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><rect x="3" y="10" width="18" height="3" rx="1" /><path d="M5 13v7c0 .6.4 1 1 1h12c.6 0 1-.4 1-1v-7" fillOpacity="0.3" /><rect x="11" y="10" width="2" height="11" /></svg>,
  주식: <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><rect x="4" y="14" width="3" height="7" rx="0.5" fillOpacity="0.4" /><rect x="8.5" y="11" width="3" height="10" rx="0.5" fillOpacity="0.6" /><rect x="13" y="8" width="3" height="13" rx="0.5" fillOpacity="0.8" /><rect x="17.5" y="5" width="3" height="16" rx="0.5" /></svg>,
};

export const childIcons: Record<string, React.ReactNode> = {
  홈:   <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M12 3C11.4 3 10.8 3.3 10.4 3.7L3.7 9.5C3.3 9.9 3 10.5 3 11.1V19c0 1.1.9 2 2 2h4.5v-6h5v6H19c1.1 0 2-.9 2-2v-7.9c0-.6-.3-1.2-.7-1.6l-6.7-5.8C13.2 3.3 12.6 3 12 3z" /></svg>,
  알림: <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M12 2a1.5 1.5 0 011.5 1.5v.3A6 6 0 0118 9.5c0 3.5 1 5.5 2 7 .3.4 0 1-.5 1H4.5c-.5 0-.8-.6-.5-1 1-1.5 2-3.5 2-7a6 6 0 014.5-5.7v-.3A1.5 1.5 0 0112 2z" /><path d="M9.5 17.5a2.5 2.5 0 005 0" /></svg>,
  설정: <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z" /></svg>,
};

/** 부모/자녀 화면 전환 토글 (데모용) */
export const RoleToggle = ({ role, onToggle }: { role: "parent" | "child"; onToggle: () => void }) => (
  <button
    onClick={onToggle}
    className={`flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg text-gray-900 border active:scale-95 transition-transform ${
      role === "parent" ? "bg-blue-50 border-blue-100" : "bg-emerald-50 border-emerald-100"
    }`}
  >
    {role === "parent" ? "부모" : "자녀"}
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-3.5 h-3.5 opacity-60"><path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" /></svg>
  </button>
);

/** 뒤로가기 화살표 + 큰 제목 */
export const PageHeader = ({ title, onBack }: { title: string; onBack: () => void }) => (
  <div className="flex items-center gap-3 py-2">
    <button onClick={onBack} className="text-gray-500 active:scale-90 transition-transform">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M15 18l-6-6 6-6" /></svg>
    </button>
    <p className="text-[24px] font-bold text-gray-900 tracking-tight">{title}</p>
  </div>
);
