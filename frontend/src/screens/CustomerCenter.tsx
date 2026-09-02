// 고객센터 — 자주 묻는 질문, 전화 상담, 문의 접수.
// 문의는 실제로 접수돼 아래 목록에 그대로 쌓인다(로컬 저장, 상담원 배정은 없음).

import { useState } from "react";
import officialContacts from "../../../shared/official-contacts.json";
import { PageHeader } from "../shared/ui";
import { fmtLogTime } from "../shared/guardianLog";
import { submitInquiry, useInquiries } from "../shared/inquiries";

const FAQS: { q: string; a: string }[] = [
  {
    q: "안심동행 AI가 뭔가요?",
    a: "고액·신규 계좌 송금처럼 위험 신호가 있는 거래를 AI가 먼저 확인하고, 필요하면 가족에게도 함께 알려 보이스피싱 피해를 막는 기능이에요. 정상 거래는 평소처럼 그대로 진행돼요.",
  },
  {
    q: "가족 연동은 어떻게 하나요?",
    a: "홈 화면의 '안심동행 AI' 카드에서 연동 코드를 만들어 가족에게 전달하면 연결돼요. 언제든 설정에서 해제할 수 있어요.",
  },
  {
    q: "송금이 보류됐어요, 왜 그런가요?",
    a: "새 계좌·고액 송금처럼 위험 신호가 확인되면 잠시 정지 후 AI와 대화로 상황을 확인해요. 차단이 아니라 확인 절차라 정상 거래면 그대로 진행할 수 있어요.",
  },
  {
    q: "이체한도는 어떻게 올리나요?",
    a: "홈 화면의 '이체한도 관리'에서 원하는 한도로 바로 상향할 수 있어요.",
  },
  {
    q: "개인정보는 안전하게 보관되나요?",
    a: "잔액·거래내역 같은 민감정보는 가족에게 공유되지 않고, 위험 판단에 필요한 최소 정보만 기록해요. 자세한 내용은 개인정보처리방침에서 확인하실 수 있어요.",
  },
];

export default function CustomerCenter({ onBack, bankName = "한결은행" }: { onBack: () => void; bankName?: string }) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const inquiries = useInquiries();

  const supportPhone = officialContacts.phones.find((p) => p.name === bankName)?.value ?? "15885000";

  const handleSubmit = () => {
    if (!draft.trim()) return;
    submitInquiry(draft);
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-4 pb-6">
      <PageHeader title="고객센터" onBack={onBack} />

      {/* 빠른 연락 */}
      <div className="bg-white rounded-2xl p-5 flex items-center justify-between">
        <div>
          <p className="text-[15px] font-bold text-gray-900">전화 상담</p>
          <p className="text-[12px] text-gray-400 mt-0.5">평일 09:00 - 18:00 (주말·공휴일 휴무)</p>
        </div>
        <a
          href={`tel:${supportPhone}`}
          className="flex items-center gap-1.5 rounded-xl bg-[var(--ac-500)] px-4 py-2.5 text-[13px] font-bold text-white active:scale-[0.98] transition-transform"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.86 19.86 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.86 19.86 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0122 16.92z" />
          </svg>
          전화하기
        </a>
      </div>

      {/* 자주 묻는 질문 */}
      <div className="bg-white rounded-2xl p-5">
        <p className="text-[15px] font-bold text-gray-900 mb-3">자주 묻는 질문</p>
        <div className="flex flex-col">
          {FAQS.map((item, i) => (
            <div key={item.q} className={i > 0 ? "border-t border-gray-100" : ""}>
              <button
                onClick={() => setOpenFaq((current) => (current === i ? null : i))}
                className="w-full py-3 flex items-center justify-between text-left active:scale-[0.99] transition-transform"
              >
                <span className="text-[13px] font-semibold text-gray-900 pr-3">{item.q}</span>
                <svg
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${openFaq === i ? "rotate-180" : ""}`}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {openFaq === i && (
                <p className="pb-3 text-[13px] text-gray-500 leading-relaxed">{item.a}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 문의하기 */}
      <div className="bg-white rounded-2xl p-5">
        <p className="text-[15px] font-bold text-gray-900 mb-3">1:1 문의하기</p>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="궁금하신 점을 남겨주시면 확인 후 답변드릴게요."
          rows={4}
          className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-[13px] text-gray-900 placeholder-gray-300 outline-none focus:border-[var(--ac-400)] focus:ring-2 focus:ring-[var(--ac-50)] transition-all"
        />
        <button
          onClick={handleSubmit}
          disabled={!draft.trim()}
          className="w-full mt-3 py-3.5 rounded-xl text-[14px] font-bold text-white bg-[var(--ac-500)] disabled:opacity-40 active:scale-[0.98] transition-all"
        >
          문의 등록
        </button>
      </div>

      {/* 문의 내역 */}
      {inquiries.length > 0 && (
        <div className="bg-white rounded-2xl p-5">
          <p className="text-[15px] font-bold text-gray-900 mb-3">내 문의 내역</p>
          <div className="flex flex-col gap-3">
            {inquiries.map((item) => (
              <div key={item.id} className="rounded-xl bg-gray-50 p-3.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="rounded-full bg-[var(--ac-50)] px-2 py-0.5 text-[10px] font-bold text-[var(--ac-700)]">
                    {item.status}
                  </span>
                  <span className="text-[11px] text-gray-400">{fmtLogTime(item.createdAt)}</span>
                </div>
                <p className="text-[13px] text-gray-700 whitespace-pre-wrap break-words">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
