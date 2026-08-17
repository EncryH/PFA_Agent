// 상대방 검증 화면 — 전화번호·URL·기관명을 검증해 안전 여부를 알린다.

import { useState } from "react";

function formatPhoneNumber(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (!d) return '';
  // 서울 02: 02-XXX-XXXX(9자리) 또는 02-XXXX-XXXX(10자리)
  if (d.startsWith('02')) {
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0,2)}-${d.slice(2)}`;
    if (d.length <= 9) return `${d.slice(0,2)}-${d.slice(2,5)}-${d.slice(5)}`;
    return `${d.slice(0,2)}-${d.slice(2,6)}-${d.slice(6,10)}`;
  }
  // 010·070·0XX 등: 3+4+4
  if (d.startsWith('0')) {
    if (d.length <= 3) return d;
    if (d.length <= 7) return `${d.slice(0,3)}-${d.slice(3)}`;
    return `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7,11)}`;
  }
  // 15XX·16XX 등 4자리 대표번호: XXXX-XXXX
  if (d.length <= 4) return d;
  return `${d.slice(0,4)}-${d.slice(4,8)}`;
}
import { verifyPhone, verifyUrl, verifyInstitution, type VerifyResult } from "../shared/verify";

type Tab = "전화번호" | "링크·URL" | "기관명";

const TABS: Tab[] = ["전화번호", "링크·URL", "기관명"];

const PLACEHOLDERS: Record<Tab, string> = {
  "전화번호": "예) 02-1234-5678 또는 15881688",
  "링크·URL": "예) https://kbstar.com/...",
  "기관명":   "예) KB국민은행, 금융감독원",
};

const STATUS_COLORS: Record<VerifyResult["status"], string> = {
  safe:    "bg-green-50 border-green-200 text-green-800",
  caution: "bg-yellow-50 border-yellow-200 text-yellow-800",
  danger:  "bg-red-50 border-red-200 text-red-800",
  unknown: "bg-gray-50 border-gray-200 text-gray-700",
};

const STATUS_ICONS: Record<VerifyResult["status"], string> = {
  safe:    "✅",
  caution: "⚠️",
  danger:  "🚨",
  unknown: "❓",
};

export default function Verify({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<Tab>("전화번호");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);

  const handleVerify = async () => {
    const q = input.trim();
    if (!q) return;
    setLoading(true);
    setResult(null);
    try {
      let r: VerifyResult;
      if (tab === "전화번호") r = await verifyPhone(q);
      else if (tab === "링크·URL") r = await verifyUrl(q);
      else r = await verifyInstitution(q);
      setResult(r);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setInput(""); setResult(null); };

  return (
    <div className="flex flex-col gap-4 pb-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3 pt-1">
        <button onClick={onBack} className="text-gray-400 active:scale-90 transition-transform">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div>
          <h1 className="text-[18px] font-bold text-gray-900">상대방 검증</h1>
          <p className="text-[12px] text-gray-400">번호·링크·기관명의 안전 여부를 확인합니다</p>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); reset(); }}
            className={`flex-1 py-2 rounded-lg text-[13px] font-medium transition-all ${
              tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* 입력 */}
      <div className="bg-white rounded-2xl p-5 flex flex-col gap-3">
        <p className="text-[13px] font-semibold text-gray-700">
          {tab === "전화번호" && "확인할 전화번호를 입력하세요"}
          {tab === "링크·URL" && "확인할 링크 또는 URL을 입력하세요"}
          {tab === "기관명" && "확인할 금융기관 또는 기관명을 입력하세요"}
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode={tab === "전화번호" ? "numeric" : "text"}
            value={input}
            onChange={(e) => {
              const v = tab === "전화번호" ? formatPhoneNumber(e.target.value) : e.target.value;
              setInput(v);
              setResult(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && handleVerify()}
            placeholder={PLACEHOLDERS[tab]}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-[14px] text-gray-900 placeholder-gray-300 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all"
          />
          {input && (
            <button onClick={reset} className="text-gray-300 px-2 active:scale-90 transition-transform">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <button
          onClick={handleVerify}
          disabled={!input.trim() || loading}
          className="w-full py-3 rounded-xl bg-blue-600 text-white text-[14px] font-semibold active:scale-[0.98] hover:bg-blue-700 disabled:opacity-40 transition-all"
        >
          {loading ? "검증 중…" : "검증하기"}
        </button>
      </div>

      {/* 결과 */}
      {result && (
        <div className={`rounded-2xl border p-5 ${STATUS_COLORS[result.status]}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[22px]">{STATUS_ICONS[result.status]}</span>
            <p className="text-[16px] font-bold">{result.label}</p>
          </div>
          <p className="text-[13px] leading-relaxed">{result.detail}</p>

          {result.thecheat?.found && (
            <div className="mt-3 pt-3 border-t border-current/20">
              <p className="text-[12px] font-semibold mb-1">더치트 신고 내역</p>
              <p className="text-[12px]">신고 건수: {result.thecheat.reportCount}건</p>
              <p className="text-[12px]">사기 유형: {result.thecheat.scamTypes.join(", ")}</p>
              <p className="text-[12px]">최근 신고: {result.thecheat.lastReported}</p>
            </div>
          )}
        </div>
      )}

      {/* 안내 */}
      <div className="bg-blue-50 rounded-2xl p-4">
        <p className="text-[13px] font-semibold text-blue-800 mb-2">이용 안내</p>
        <ul className="text-[12px] text-blue-700 space-y-1">
          <li>• 금융위원회 OpenAPI로 등록 금융사를 실시간 조회합니다.</li>
          <li>• 더치트 사기 신고 데이터베이스와 대조합니다.</li>
          <li>• 공식 번호·도메인 화이트리스트와 비교합니다.</li>
          <li>• 결과는 참고용이며 최종 판단은 본인이 직접 확인하세요.</li>
        </ul>
      </div>
    </div>
  );
}
