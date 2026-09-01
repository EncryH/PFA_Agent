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

const STATUS_BADGES: Record<VerifyResult["status"], { label: string; className: string }> = {
  safe:    { label: "공식 확인", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  caution: { label: "주의 필요", className: "bg-red-50 text-red-700 border-red-200" },
  danger:  { label: "위험 정황", className: "bg-red-50 text-red-700 border-red-200" },
  unknown: { label: "공식 번호 미확인", className: "bg-[var(--ac-50)] text-[var(--ac-700)] border-[var(--ac-200)]" },
};

const STATUS_GUIDANCE: Record<VerifyResult["status"], string> = {
  safe: "공식 번호가 맞더라도 비밀번호·인증번호·송금을 요구하면 전화를 끊고 공식 앱에서 다시 확인하세요.",
  caution: "상대방이 알려준 번호로 다시 연락하지 말고, 해당 기관의 공식 앱이나 대표번호로 직접 확인하세요.",
  danger: "지금은 연락과 송금을 멈추고, 해당 기관의 공식 대표번호 또는 경찰청 112로 확인하세요.",
  unknown: "상대방이 알려준 번호로 다시 연락하지 말고, 송금 전 해당 기관의 공식 앱이나 대표번호로 직접 확인하세요.",
};

const NUMBER_ASSESSMENTS: Record<VerifyResult["status"], { label: string; className: string }> = {
  safe:    { label: "공식 번호로 확인", className: "bg-emerald-50 text-emerald-700" },
  caution: { label: "추가 확인 필요", className: "bg-red-50 text-red-700" },
  danger:  { label: "위험 정황 확인", className: "bg-red-50 text-red-700" },
  unknown: { label: "공식 번호 미확인", className: "bg-gray-100 text-gray-600" },
};

export default function Verify({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<Tab>("전화번호");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [checkedPhone, setCheckedPhone] = useState("");

  const handleVerify = async () => {
    const q = input.trim();
    if (!q) return;
    setLoading(true);
    setResult(null);
    setCheckedPhone(tab === "전화번호" ? formatPhoneNumber(q) : "");
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

  const reset = () => { setInput(""); setResult(null); setCheckedPhone(""); };

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
            className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-[14px] text-gray-900 placeholder-gray-300 outline-none focus:border-[var(--ac-400)] focus:ring-2 focus:ring-[var(--ac-50)] transition-all"
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
          className="w-full py-3 rounded-xl bg-[var(--ac-600)] text-white text-[14px] font-semibold active:scale-[0.98] hover:bg-[var(--ac-700)] disabled:opacity-40 transition-all"
        >
          {loading ? "검증 중…" : "검증하기"}
        </button>
      </div>

      {/* 결과 */}
      {result && (
        <div className="flex items-start gap-3">
          <img
            src="/ansim-ai-profile.png"
            alt="안심동행 AI"
            className="mt-1 h-10 w-10 shrink-0 rounded-full border border-[var(--ac-100)] bg-white object-cover shadow-sm"
          />
          <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-[var(--ac-100)] bg-gradient-to-br from-[var(--ac-50)] to-white p-5 shadow-sm">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[12px] font-bold text-[var(--ac-700)]">
                <span className="h-2 w-2 rounded-full bg-[var(--ac-500)]" />
                안심동행 AI 확인
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${STATUS_BADGES[result.status].className}`}>
                {STATUS_BADGES[result.status].label}
              </span>
            </div>

            <section>
              <p className="text-[14px] font-bold text-[var(--ac-700)]">확인한 내용이에요</p>
              {checkedPhone && (
                <div className="mt-2 space-y-2 rounded-xl bg-white p-3.5 text-[12px] shadow-sm ring-1 ring-[var(--ac-100)]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-gray-500">확인한 번호</span>
                    <strong className="text-[14px] tracking-wide text-gray-900">{checkedPhone}</strong>
                  </div>
                  {result.institutionName && (
                    <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-2">
                      <span className="font-semibold text-gray-500">확인된 기관</span>
                      <strong className="text-[13px] text-gray-900">{result.institutionName}</strong>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-2">
                    <span className="font-semibold text-gray-500">번호 판정</span>
                    <strong className={`rounded-full px-2.5 py-1 text-[10px] ${NUMBER_ASSESSMENTS[result.status].className}`}>
                      {NUMBER_ASSESSMENTS[result.status].label}
                    </strong>
                  </div>
                </div>
              )}
              <p className="mt-3 text-[17px] font-bold leading-snug text-gray-900">{result.label}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-gray-700">{result.detail}</p>
            </section>

            {result.provider && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ac-100)] bg-white px-2.5 py-1 text-[10px] font-semibold text-[var(--ac-700)]">
                  <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
                    <path d="M12 3l7 3v5c0 4.6-2.8 8-7 10-4.2-2-7-5.4-7-10V6l7-3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {result.provider}
                </span>
                {result.searchStatus === "partial" && (
                  <span className="text-[10px] text-gray-500">일부 검색 결과만 반영했어요</span>
                )}
                {result.searchStatus === "unavailable" && (
                  <span className="text-[10px] text-amber-700">NAVER 검색을 완료하지 못했어요</span>
                )}
              </div>
            )}

            {!!result.listChecks?.filter((check) => check.label !== "위험번호 신고 이력" && check.label !== "MVP 위험번호 목록").length && (
              <section className="mt-5 border-t border-[var(--ac-100)] pt-4">
                <p className="text-[14px] font-bold text-[var(--ac-700)]">근거 결합 결과예요</p>
                <div className="mt-3 space-y-2">
                  {result.listChecks
                    .filter((check) => check.label !== "위험번호 신고 이력" && check.label !== "MVP 위험번호 목록")
                    .map((check) => (
                    <div key={`${check.type}-${check.label}`} className="rounded-xl border border-gray-100 bg-white p-3.5 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[12px] font-bold text-gray-900">{check.label}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                          check.available === false
                            ? "bg-amber-50 text-amber-700"
                            : check.type === "whitelist" && check.matched
                            ? "bg-emerald-50 text-emerald-700"
                            : check.type === "blacklist" && check.matched
                              ? "bg-red-50 text-red-700"
                              : "bg-gray-100 text-gray-500"
                        }`}>
                          {check.available === false ? "확인 불가" : check.matched ? "일치" : "일치 없음"}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-gray-600">{check.detail}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {!!result.sources?.length && (
              <section className="mt-5 border-t border-[var(--ac-100)] pt-4">
                <p className="text-[14px] font-bold text-[var(--ac-700)]">확인한 웹 근거예요</p>
                <div className="mt-3 space-y-2">
                  {result.sources.map((source) => (
                    <a
                      key={source.url}
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group block rounded-xl border border-gray-100 bg-white p-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--ac-200)] hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[12px] font-bold leading-snug text-gray-900">{source.title}</p>
                        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5" aria-hidden="true">
                          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-gray-600">
                        {source.kind === "risk"
                          ? `입력 번호와 ${source.signals.join("·")} 정황이 함께 언급된 공개 문서입니다.`
                          : source.description}
                      </p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        {source.kind === "official" ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">공식 사이트</span>
                        ) : source.trusted && (
                          <span className="rounded-full bg-[var(--ac-50)] px-2 py-0.5 text-[9px] font-bold text-[var(--ac-700)]">공공 출처</span>
                        )}
                        {source.signals.map((signal) => (
                          <span key={signal} className="rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-medium text-gray-600">
                            {signal}
                          </span>
                        ))}
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {result.thecheat?.found && (
              <section className="mt-5 border-t border-[var(--ac-100)] pt-4">
                <p className="text-[14px] font-bold text-[var(--ac-700)]">확인된 신고 정보예요</p>
                <div className="mt-2 rounded-xl border border-gray-100 bg-white p-3 text-[11px] leading-relaxed text-gray-600">
                  <p>신고 건수: {result.thecheat.reportCount}건</p>
                  <p>사기 유형: {result.thecheat.scamTypes.join(", ")}</p>
                  <p>최근 신고: {result.thecheat.lastReported}</p>
                </div>
              </section>
            )}

            <section className="mt-5 border-t border-[var(--ac-100)] pt-4">
              <p className="text-[14px] font-bold text-[var(--ac-700)]">지금 이렇게 확인해 주세요</p>
              <div className="mt-2 flex items-start gap-2 rounded-xl bg-white p-3.5 text-[12px] leading-relaxed text-gray-700 shadow-sm">
                <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ac-600)]" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M8.5 12l2.2 2.2 4.8-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p>{STATUS_GUIDANCE[result.status]}</p>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* 안내 */}
      <div className="bg-[var(--ac-50)] rounded-2xl p-4">
        <p className="text-[13px] font-semibold text-[var(--ac-700)] mb-2">이용 안내</p>
        {tab === "전화번호" ? (
          <ul className="text-[12px] text-[var(--ac-600)] space-y-1">
            <li>• 예금보험공사 부보금융회사 정보와 공식 대표번호 목록을 함께 확인합니다.</li>
            <li>• 모든 번호를 NAVER 공식 출처와 위험 정황으로 함께 검색합니다.</li>
            <li>• 입력 번호는 검색에만 사용하며 앱에 저장하지 않습니다.</li>
            <li>• 검색 결과가 없다고 안전이 보장되는 것은 아닙니다.</li>
          </ul>
        ) : tab === "링크·URL" ? (
          <ul className="text-[12px] text-[var(--ac-600)] space-y-1">
            <li>• 공식 도메인 목록과 Google Safe Browsing 결과를 확인합니다.</li>
            <li>• 출처가 불분명한 링크는 직접 열지 마세요.</li>
            <li>• 결과는 참고용이며 공식 앱에서 다시 확인하세요.</li>
          </ul>
        ) : (
          <ul className="text-[12px] text-[var(--ac-600)] space-y-1">
            <li>• 금융위원회 OpenAPI와 공식 기관 목록을 확인합니다.</li>
            <li>• 유사한 기관명이 존재하면 정확한 명칭을 안내합니다.</li>
            <li>• 상대방이 안내한 연락처가 아닌 공식 채널로 다시 확인하세요.</li>
          </ul>
        )}
      </div>
    </div>
  );
}
