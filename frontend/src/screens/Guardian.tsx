// 안심동행 설정 화면 — 서비스 소개 → 역할 선택 → 페어링 코드 → 완료
//
// MVP 페어링: 부모 앱이 만든 1회용 코드를 자녀 앱에서 검증하면 양쪽에 연결 상태를 반영한다.

import { useEffect, useState } from "react";
import { pushNotice, readNotices } from "../shared/data";
import {
  deleteIntentChatSession,
  INTENT_CHAT_EVENT,
  readIntentChatSessions,
  type IntentChatSession,
} from "../shared/intentChat";
import {
  AI_REVIEW_THRESHOLD_OPTIONS,
  PROTECTION_LEVELS,
  getProtectionDisplayLevel,
  useAiReviewThreshold,
  useProtectionLevel,
  type AiReviewThreshold,
  type ProtectionLevel,
} from "../shared/protection";
import { deleteGuardianLogEntry, fmtLogTime, useGuardianLog } from "../shared/guardianLog";
import {
  EMERGENCY_RECEIPT_EVENT,
  readEmergencyReceipts,
  type EmergencyReceipt,
} from "../shared/emergencyReceipt";

type Step = "intro" | "select" | "code" | "done" | "permissions";

type PendingAlert = {
  amount: number;
  account: string;
  bank?: string;
  signals?: string[];
  time?: string;
  sessionId?: string;
};

const readPendingAlert = (): PendingAlert | null => {
  try {
    const stored = localStorage.getItem("ansimAlert");
    return stored ? JSON.parse(stored) as PendingAlert : null;
  } catch {
    return null;
  }
};

const DEMO_PAIR_CODE = "3827";
const PAIR_CODE_KEY = "ansimPairCode";
const PAIRED_KEY = "ansimPaired";
const PAIRED_AT_KEY = "ansimPairedAt";   // 연결 시각 — 알림함에 그대로 표시된다
const PAIRED_EVENT = "ansim-paired";

const CORE_STAGES = [
  { step: "1", title: "상대방이 믿을 만한지 확인해요", desc: "받으신 번호·문자·링크와 수취 정보를 공식 정보와 대조해요" },
  { step: "2", title: "평소와 다른 행동을 알아채요",   desc: "잔액을 반복해서 보거나 적금을 깨는 등 낯선 흐름을 살펴요" },
  { step: "3", title: "왜 보내는 돈인지 함께 확인해요", desc: "이전 거래 패턴과 대화를 함께 보고 사기 송금 의도를 분석해요" },
  { step: "4", title: "피해가 생겼다면 바로 대응해요", desc: "지급정지·112 신고·피해구제·증거 보관 순서로 도와드려요" },
];

const PROMISES = [
  { t: "자녀는 잔액과 거래내역을 볼 수 없어요", d: "어떤 보호 범위를 고르셔도 통장 잔액, 어디에 쓰셨는지는 부모님만 보십니다" },
  { t: "위험한 순간의 상황만 전달돼요",         d: '"처음 보는 곳에 큰 금액을 보내려 하십니다" 정도만 자녀에게 알려요' },
  { t: "언제든 그만두실 수 있어요",             d: "가족 보호 범위를 줄이거나 연결을 해제하는 것은 부모님 뜻대로예요" },
];

export default function Guardian({
  onExit, appRole, onResumeIntentChat, onOpenPendingConfirmation, onOpenPendingRequest,
}: {
  onExit: () => void;
  appRole: "parent" | "child";
  onResumeIntentChat?: (id: string) => void;
  onOpenPendingConfirmation?: (id: string) => void;
  onOpenPendingRequest?: () => void;
}) {
  const [step, setStep] = useState<Step>("intro");
  const [pairRole, setPairRole] = useState<"parent" | "child" | null>(null);
  const [code, setCode] = useState(["", "", "", ""]);
  const [codeError, setCodeError] = useState("");
  const [isPaired, setIsPaired] = useState(() => localStorage.getItem(PAIRED_KEY) === "true");
  const [intentChats, setIntentChats] = useState<IntentChatSession[]>(() => readIntentChatSessions());
  const guardianLog = useGuardianLog();
  const [openLogId, setOpenLogId] = useState<string | null>(null);
  const openLog = guardianLog.find((entry) => entry.id === openLogId) ?? null;
  const [openChatMenuId, setOpenChatMenuId] = useState<string | null>(null);
  const [openLogMenuId, setOpenLogMenuId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<null | { kind: "chat" | "log"; id: string }>(null);
  const [pendingAlert, setPendingAlert] = useState<PendingAlert | null>(readPendingAlert);
  const [protectionLevel, setProtectionLevel] = useProtectionLevel();
  const [aiReviewThreshold, setAiReviewThreshold] = useAiReviewThreshold();
  const protection = PROTECTION_LEVELS[protectionLevel];
  // 가족 보호 범위는 위험 판정에 영향을 주므로 저장 전에 한 번 더 묻는다
  const [pendingLevel, setPendingLevel] = useState<ProtectionLevel | null>(null);
  const [expandedLevel, setExpandedLevel] = useState<ProtectionLevel | null>(null);
  const [emergencyReceipts, setEmergencyReceipts] = useState<EmergencyReceipt[]>(readEmergencyReceipts);
  const [openEmergencyReceipt, setOpenEmergencyReceipt] = useState<EmergencyReceipt | null>(null);
  const [showPairDetails, setShowPairDetails] = useState(false);
  const [showManageMenu, setShowManageMenu] = useState(false);
  const [draftAiReviewThreshold, setDraftAiReviewThreshold] = useState<AiReviewThreshold>(aiReviewThreshold);
  const [customThresholdManwon, setCustomThresholdManwon] = useState(() => String(Math.floor(aiReviewThreshold / 10_000)));

  useEffect(() => {
    setDraftAiReviewThreshold(aiReviewThreshold);
    setCustomThresholdManwon(String(Math.floor(aiReviewThreshold / 10_000)));
  }, [aiReviewThreshold]);

  const selectAiReviewThreshold = (amount: AiReviewThreshold) => {
    if (appRole !== "parent") return;
    setDraftAiReviewThreshold(amount);
    setCustomThresholdManwon(String(Math.floor(amount / 10_000)));
  };

  const applyAiReviewThreshold = () => {
    if (appRole !== "parent" || !customThresholdManwon) return;
    setAiReviewThreshold(draftAiReviewThreshold);
  };

  const confirmLevelChange = () => {
    if (pendingLevel === null) return;
    const previous = protectionLevel;
    setProtectionLevel(pendingLevel);
    pushNotice("level-changed", new Date().toISOString(), { from: previous, to: pendingLevel });
    setPendingLevel(null);
  };

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

  useEffect(() => {
    const syncChats = () => setIntentChats(readIntentChatSessions());
    window.addEventListener(INTENT_CHAT_EVENT, syncChats);
    window.addEventListener("storage", syncChats);
    return () => {
      window.removeEventListener(INTENT_CHAT_EVENT, syncChats);
      window.removeEventListener("storage", syncChats);
    };
  }, []);

  useEffect(() => {
    const syncReceipts = () => setEmergencyReceipts(readEmergencyReceipts());
    window.addEventListener(EMERGENCY_RECEIPT_EVENT, syncReceipts);
    window.addEventListener("storage", syncReceipts);
    return () => {
      window.removeEventListener(EMERGENCY_RECEIPT_EVENT, syncReceipts);
      window.removeEventListener("storage", syncReceipts);
    };
  }, []);

  useEffect(() => {
    const syncAlert = () => setPendingAlert(readPendingAlert());
    window.addEventListener("ansim-alert", syncAlert);
    window.addEventListener("storage", syncAlert);
    return () => {
      window.removeEventListener("ansim-alert", syncAlert);
      window.removeEventListener("storage", syncAlert);
    };
  }, []);

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
    localStorage.setItem(PAIRED_AT_KEY, new Date().toISOString());
    localStorage.removeItem(PAIR_CODE_KEY);
    pushNotice("paired");
    setIsPaired(true);
    setCodeError("");
    setStep("done");
    window.dispatchEvent(new Event(PAIRED_EVENT));
  };

  const disconnectFamily = () => {
    const target = appRole === "parent" ? "자녀와의 안심동행 연결" : "부모님과의 안심동행 연결";
    if (!window.confirm(`${target}을 해제할까요?\n해제 후에는 위험 거래 알림이 전달되지 않아요.`)) return;

    // 이전 버전에서 연결한 세션은 완료 알림 로그가 없을 수 있다.
    // 해제 전에 누락된 연결 기록을 복원해 두 알림이 모두 남게 한다.
    const notices = readNotices();
    if (notices.at(-1)?.type !== "paired") {
      const pairedAt = localStorage.getItem(PAIRED_AT_KEY)
        ?? new Date(Date.now() - 1000).toISOString();
      pushNotice("paired", pairedAt);
    }

    localStorage.removeItem(PAIRED_KEY);
    localStorage.removeItem(PAIRED_AT_KEY);
    localStorage.removeItem(PAIR_CODE_KEY);
    pushNotice("unpaired");
    setIsPaired(false);
    setPairRole(null);
    setStep("intro");
    window.dispatchEvent(new Event(PAIRED_EVENT));
  };

  const goBack = () => {
    if (step === "select" || step === "permissions") setStep("intro");
    else onExit();
  };

  const deleteChat = (id: string) => {
    setOpenChatMenuId(null);
    setPendingDelete({ kind: "chat", id });
  };

  const deleteLog = (id: string) => {
    setOpenLogMenuId(null);
    setPendingDelete({ kind: "log", id });
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;

    if (pendingDelete.kind === "chat") {
      deleteIntentChatSession(pendingDelete.id);
      setOpenChatMenuId(null);
    } else {
      deleteGuardianLogEntry(pendingDelete.id);
      setOpenLogMenuId(null);
      if (openLogId === pendingDelete.id) setOpenLogId(null);
    }

    setPendingDelete(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 py-2">
        <button onClick={goBack} className="text-gray-500 active:scale-90 transition-transform">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <p className="text-[17px] font-bold text-gray-900">안심동행 AI</p>
      </div>

      {/* 연결 전 안내에서만 노출한다. 연결 후에는 상태 카드가 같은 역할을 한다. */}
      {!isPaired && (
        <div className="bg-gradient-to-br from-[var(--ac-band-from)] via-[var(--ac-band-via)] to-[var(--ac-band-to)] border border-[var(--ac-band-border)] rounded-2xl p-4 flex items-center gap-4">
          <svg viewBox="0 0 48 48" fill="var(--ac-band-icon)" fillOpacity="0.9" className="w-14 h-14 shrink-0"><circle cx="14" cy="12" r="4.5" /><path d="M14 17c-4 0-7 3-7 7v6h14v-6c0-4-3-7-7-7z" /><circle cx="34" cy="12" r="4.5" /><path d="M34 17c-4 0-7 3-7 7v6h14v-6c0-4-3-7-7-7z" /><circle cx="24" cy="20" r="3.5" /><path d="M24 24c-3 0-5.5 2.5-5.5 5.5V36h11v-6.5c0-3-2.5-5.5-5.5-5.5z" /></svg>
          <div>
            <p className="text-[17px] font-bold text-[var(--ac-band-text)]">부모님 금융을 가족이 함께 지켜요</p>
            <p className="text-[12px] text-[var(--ac-band-sub)] mt-1">AI가 위험한 송금을 확인하고, 원할 때만 가족과 함께 살펴봐요</p>
          </div>
        </div>
      )}

      {step === "intro" && isPaired && (
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl border border-[var(--ac-100)] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[18px] font-bold text-gray-900">안심동행 AI</p>
                <p className="mt-2 text-[14px] leading-relaxed text-gray-600">
                  {appRole === "parent" ? "딸 김지혜님과 연결되어 있어요." : "어머니 김영순님과 연결되어 있어요."}
                </p>
                <p className="mt-1 text-[13px] font-semibold text-gray-900">
                  현재 가족 보호: {protection.name}
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--ac-50)] px-3 py-1.5 text-[12px] font-semibold text-[var(--ac-600)]">
                <span className="h-2 w-2 rounded-full bg-[var(--ac-500)]" />연결됨
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowPairDetails((current) => !current)}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 py-3 text-[13px] font-bold text-gray-700 active:scale-[0.98] transition-all"
            >
              {showPairDetails ? "자세히 접기" : "자세히 보기"}
              <svg viewBox="0 0 24 24" fill="none" className={`h-4 w-4 transition-transform ${showPairDetails ? "rotate-180" : ""}`}>
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {showPairDetails && (
              <div className="mt-4 border-t border-gray-100 pt-4" style={{ animation: "fade-in .18s ease-out" }}>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl bg-gray-50 px-4 py-4 text-center">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-bold text-gray-900">김영순</p>
                    <p className="mt-1 text-[11px] text-gray-400">한결은행</p>
                    <p className="mt-0.5 text-[10px] font-semibold text-gray-500">부모</p>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="flex items-center">
                      <span className="h-px w-4 bg-[var(--ac-200)]" />
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--ac-50)] text-[var(--ac-500)]">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></svg>
                      </span>
                      <span className="h-px w-4 bg-[var(--ac-200)]" />
                    </div>
                    <p className="mt-1 text-[9px] font-semibold text-[var(--ac-500)]">안심동행</p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-bold text-gray-900">김지혜</p>
                    <p className="mt-1 text-[11px] text-gray-400">나눔은행</p>
                    <p className="mt-0.5 text-[10px] font-semibold text-gray-500">자녀</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-xl border border-gray-100 px-3 py-3">
                    <p className="text-[13px] font-bold text-gray-900">Lv.{getProtectionDisplayLevel(protectionLevel)} {protection.name}</p>
                    <p className="mt-1 text-[10px] text-gray-400">현재 가족 보호</p>
                  </div>
                  <div className="rounded-xl border border-gray-100 px-3 py-3">
                    <p className="text-[13px] font-bold text-gray-900">2026.08.15</p>
                    <p className="mt-1 text-[10px] text-gray-400">연동일</p>
                  </div>
                </div>
                <div className="mt-4 flex items-start gap-2">
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--ac-500)" strokeWidth="2.5" className="mt-0.5 h-4 w-4 shrink-0"><path d="M20 6L9 17l-5-5" /></svg>
                  <p className="text-[11px] leading-relaxed text-gray-500">자녀에게는 잔액과 전체 거래내역을 공개하지 않고, 위험 확인에 필요한 정보만 전달해요.</p>
                </div>
              </div>
            )}
          </div>

          {pendingAlert && (
            <button
              type="button"
              onClick={() => {
                if (appRole === "child") {
                  onOpenPendingRequest?.();
                  return;
                }
                const sessionId = pendingAlert.sessionId ?? intentChats[0]?.id;
                if (sessionId) onOpenPendingConfirmation?.(sessionId);
              }}
              className="group w-full cursor-pointer rounded-2xl border border-[var(--ac-200)] bg-[var(--ac-50)] p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--ac-300)] hover:bg-[var(--ac-100)] hover:shadow-md active:translate-y-0 active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[16px] font-bold text-gray-900">확인이 필요한 송금이 있어요</p>
                  <p className="mt-1 text-[12px] text-gray-500">
                    {appRole === "parent" ? "자녀의 확인을 기다리고 있어요." : "부모님이 확인을 요청했어요."}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[var(--ac-700)]">가족 확인 중</span>
              </div>
              <div className="mt-4 rounded-xl bg-white/80 px-4 py-4">
                <p className="text-[22px] font-bold text-gray-900">{Number(pendingAlert.amount).toLocaleString()}원</p>
                <p className="mt-1 truncate text-[13px] text-gray-500">받는 사람: {pendingAlert.account}</p>
              </div>
              <p className="mt-4 rounded-xl bg-[var(--ac-600)] py-3 text-center text-[14px] font-bold text-white transition-transform duration-200 group-hover:-translate-y-0.5">
                확인하러 가기
              </p>
            </button>
          )}

          {appRole === "parent" && emergencyReceipts.length > 0 && (
            <div className="rounded-2xl bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[16px] font-bold text-gray-900">긴급 대응 접수 {emergencyReceipts.length}건</p>
                  <p className="mt-1 text-[12px] text-gray-500">기관 확인 중</p>
                </div>
                <span className="shrink-0 rounded-full bg-[var(--ac-50)] px-2.5 py-1 text-[10px] font-bold text-[var(--ac-700)]">진행 중</span>
              </div>
              <button
                type="button"
                onClick={() => setOpenEmergencyReceipt(emergencyReceipts[0])}
                className="group mt-4 flex w-full items-center justify-between rounded-xl border border-[var(--ac-100)] bg-[var(--ac-50)] px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-[var(--ac-200)] hover:shadow-sm active:translate-y-0 active:scale-[0.99]"
              >
                <span className="text-[12px] text-gray-500">초기 대응 5개 완료</span>
                <span className="text-[13px] font-bold text-[var(--ac-700)] transition-transform group-hover:translate-x-0.5">보기 ›</span>
              </button>
            </div>
          )}

          {/* 자녀 쪽 기록 — 무엇을 보고 어떻게 판단했는지 남긴다.
              알림은 처리하면 사라지지만 판단 이력은 남아야 한다.
              실서비스에서는 조치내역 보존(5년) 요건이 적용되는 자리. */}
          {appRole === "child" && (
            <div className="rounded-2xl border border-[var(--ac-100)] bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[14px] font-bold text-gray-900">확인 기록</p>
                  <p className="mt-1 text-[11px] text-gray-400">어머니의 위험 거래를 확인하고 판단한 이력이에요.</p>
                </div>
                <span className="shrink-0 text-[12px] text-gray-400">{guardianLog.length}건</span>
              </div>

              {guardianLog.length === 0 ? (
                <div className="rounded-xl bg-gray-50 py-8 text-center">
                  <p className="text-[13px] text-gray-400">아직 확인한 기록이 없어요</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {guardianLog.map((entry) => {
                    const decided = entry.decision !== null;
                    const held = entry.decision === "held";
                    const hasChat = entry.conversation.length > 0;
                    return (
                      <div
                        key={entry.id}
                        className={`group relative w-full rounded-xl border border-gray-100 bg-gray-50 text-left transition-all ${
                          hasChat ? "hover:border-[var(--ac-200)] hover:bg-[var(--ac-50)] active:scale-[0.99]" : "cursor-default"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setOpenLogMenuId(null);
                            if (hasChat) setOpenLogId(entry.id);
                          }}
                          disabled={!hasChat}
                          className="w-full p-3 text-left"
                        >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[13px] font-bold text-gray-900">
                              {entry.fraudTypeLabel || "위험 송금 확인"}
                            </p>
                            <p className="mt-1 truncate text-[12px] text-gray-500">
                              {entry.amount.toLocaleString()}원 · {entry.account}
                            </p>
                          </div>
                          <span className={`mr-7 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            !decided ? "bg-gray-200 text-gray-600"
                              : held ? "bg-amber-50 text-amber-700"
                              : "bg-green-50 text-green-700"
                          }`}>
                            {!decided ? "판단 대기" : held ? "보류함" : "승인함"}
                          </span>
                        </div>

                        {entry.signals.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {entry.signals.slice(0, 3).map((signal) => (
                              <span key={signal} className="rounded-full border border-red-100 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600">
                                {signal}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="mt-2.5 flex flex-col gap-1 border-t border-gray-200 pt-2.5">
                          {[
                            ["위험 감지", fmtLogTime(entry.raisedAt)],
                            ["AI 대화 확인", entry.viewedAt ? fmtLogTime(entry.viewedAt) : "열어보지 않음"],
                            ["내 판단", entry.decidedAt ? `${held ? "보류" : "승인"} · ${fmtLogTime(entry.decidedAt)}` : "미처리"],
                          ].map(([label, value]) => {
                            const empty = value === "열어보지 않음" || value === "미처리";
                            return (
                              <div key={label} className="flex items-center justify-between gap-3">
                                <span className="shrink-0 text-[11px] text-gray-400">{label}</span>
                                <span className={`truncate text-[11px] font-medium ${empty ? "text-gray-300" : "text-gray-700"}`}>
                                  {value}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {hasChat && (
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <p className="text-[10px] text-gray-400">
                              부모님과 AI의 대화 {entry.conversation.length}개가 함께 보관됐어요
                            </p>
                            <span className="shrink-0 text-[11px] font-semibold text-[var(--ac-500)]">대화 보기 ›</span>
                          </div>
                        )}
                        </button>

                        <button
                          type="button"
                          aria-label={`${entry.fraudTypeLabel || "위험 송금 확인"} 메뉴`}
                          aria-expanded={openLogMenuId === entry.id}
                          onClick={() => setOpenLogMenuId((current) => current === entry.id ? null : entry.id)}
                          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-white hover:text-gray-700 active:scale-90 transition-all"
                        >
                          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                            <circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" />
                          </svg>
                        </button>

                        {openLogMenuId === entry.id && (
                          <div className="absolute right-10 top-1.5 z-20 min-w-28 origin-top-right overflow-hidden rounded-xl border border-gray-100 bg-white p-1.5 shadow-lg">
                            <button
                              type="button"
                              onClick={() => deleteLog(entry.id)}
                              className="w-full rounded-lg px-3 py-2 text-left text-[12px] font-semibold text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors"
                            >
                              기록 삭제
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <p className="mt-3 text-center text-[10px] text-gray-400">
                잔액과 거래내역은 기록에도 남지 않아요
              </p>
            </div>
          )}

          {appRole === "parent" && intentChats.length > 0 && (
            <div className="bg-white rounded-2xl p-5">
              <div className="mb-3">
                <p className="text-[14px] font-bold text-gray-900">AI 상담 기록</p>
                <p className="mt-1 text-[11px] text-gray-400">보류한 송금 상담을 눌러서 이어갈 수 있어요.</p>
              </div>
              <div className="flex flex-col gap-2">
                {intentChats.map((chat) => (
                  <div key={chat.id} className="group relative w-full rounded-xl border border-gray-100 bg-gray-50 hover:border-[var(--ac-200)] hover:bg-[var(--ac-50)] transition-all">
                    <button
                      type="button"
                      onClick={() => {
                        setOpenChatMenuId(null);
                        onResumeIntentChat?.(chat.id);
                      }}
                      className="w-full p-3 text-left active:scale-[0.99] transition-transform"
                    >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 h-9 w-9 shrink-0 overflow-hidden rounded-full border border-blue-100 bg-blue-50">
                        <img src="/ansim-ai-profile.png" alt="" className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-[13px] font-bold text-gray-900">
                            {chat.fraudTypeLabel || "위험 송금 상담"}
                          </p>
                          <span className="mr-7 shrink-0 rounded-full bg-[var(--ac-50)] px-2 py-0.5 text-[10px] font-bold text-[var(--ac-700)]">송금 보류</span>
                        </div>
                        <p className="mt-1 truncate text-[12px] text-gray-500">
                          {chat.transfer.name || "받는 분"} · {Number(chat.transfer.amount.replace(/,/g, "")).toLocaleString()}원
                        </p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <p className="truncate text-[11px] text-gray-400">{chat.riskLabels.slice(0, 2).join(" · ")}</p>
                          <span className="shrink-0 text-[11px] font-semibold text-[var(--ac-500)] group-hover:translate-x-0.5 transition-transform">이어서 대화하기 ›</span>
                        </div>
                      </div>
                    </div>
                    </button>

                    <button
                      type="button"
                      aria-label={`${chat.fraudTypeLabel || "위험 송금 상담"} 메뉴`}
                      aria-expanded={openChatMenuId === chat.id}
                      onClick={() => setOpenChatMenuId((current) => current === chat.id ? null : chat.id)}
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-white hover:text-gray-700 active:scale-90 transition-all"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                        <circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" />
                      </svg>
                    </button>

                    {openChatMenuId === chat.id && (
                      <div className="absolute right-10 top-1.5 z-20 min-w-28 origin-top-right overflow-hidden rounded-xl border border-gray-100 bg-white p-1.5 shadow-lg">
                        <button
                          type="button"
                          onClick={() => deleteChat(chat.id)}
                          className="w-full rounded-lg px-3 py-2 text-left text-[12px] font-semibold text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors"
                        >
                          채팅 삭제
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-[var(--ac-100)] bg-white p-4 shadow-sm">
            <button
              type="button"
              onClick={() => setShowManageMenu((current) => !current)}
              className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-left active:scale-[0.98] transition-all"
            >
              <span className="text-[14px] font-bold text-gray-900">관리 메뉴</span>
              <svg viewBox="0 0 24 24" fill="none" className={`h-5 w-5 text-gray-400 transition-transform ${showManageMenu ? "rotate-180" : ""}`}>
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {showManageMenu && (
              <div className="mt-3 flex flex-col gap-2" style={{ animation: "fade-in .18s ease-out" }}>
                <button onClick={() => setStep("permissions")} className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-left active:scale-[0.98] transition-all">
                  <span>
                    <span className="block text-[13px] font-bold text-gray-900">가족 보호 범위 관리</span>
                    <span className="mt-0.5 block text-[10px] text-gray-400">알림·지연·공동확인 범위 조정</span>
                  </span>
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-gray-300">
                    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                <button onClick={disconnectFamily} className="w-full rounded-xl border border-gray-200 bg-white py-3 text-[12px] font-semibold text-red-500 active:scale-[0.98] transition-all">
                  {appRole === "parent" ? "자녀 연결 해제" : "부모님 연결 해제"}
                </button>
                <p className="text-center text-[10px] leading-relaxed text-gray-400">
                  연결을 해제해도 은행 계좌와 거래내역에는 영향을 주지 않아요.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {step === "permissions" && isPaired && (
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl bg-white p-5">
            <p className="text-[16px] font-bold text-gray-900">가족 보호 범위를 선택해 주세요</p>
            <p className="mt-1 text-[12px] leading-relaxed text-gray-500">
              {appRole === "parent" ? "부모님이 직접 선택하고 언제든 변경할 수 있어요." : "가족 보호 범위는 부모님만 변경할 수 있어요."}
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--ac-100)] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[15px] font-bold text-gray-900">AI 확인 시작 금액</p>
                <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
                  이 금액 이상 송금할 때만 AI가 송금 이유를 한 번 더 확인해요.
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-[var(--ac-50)] px-2.5 py-1 text-[10px] font-bold text-[var(--ac-700)]">
                현재 {aiReviewThreshold.toLocaleString()}원
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {AI_REVIEW_THRESHOLD_OPTIONS.map((option) => {
                const active = draftAiReviewThreshold === option.amount;
                return (
                  <button
                    key={option.amount}
                    type="button"
                    disabled={appRole !== "parent"}
                    onClick={() => selectAiReviewThreshold(option.amount)}
                    className={`rounded-xl border px-3 py-3 text-left transition-all active:scale-[0.98] ${
                      active
                        ? "border-[var(--ac-400)] bg-[var(--ac-50)]"
                        : "border-gray-100 bg-gray-50"
                    } ${appRole === "parent" ? "hover:border-[var(--ac-300)]" : "cursor-default opacity-80"}`}
                  >
                    <span className={`block text-[14px] font-bold ${active ? "text-[var(--ac-700)]" : "text-gray-800"}`}>{option.label}</span>
                    <span className="mt-0.5 block text-[10px] text-gray-400">{option.desc}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
              <p className="text-[11px] font-bold text-gray-700">직접입력</p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  value={customThresholdManwon}
                  onChange={(event) => {
                    const value = event.target.value.replace(/\D/g, "");
                    setCustomThresholdManwon(value);
                    if (value) setDraftAiReviewThreshold(Math.max(1, Number(value)) * 10_000);
                  }}
                  inputMode="numeric"
                  disabled={appRole !== "parent"}
                  className="h-11 min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-right text-[15px] font-bold text-gray-900 outline-none focus:border-[var(--ac-400)] disabled:opacity-70"
                  aria-label="AI 확인 시작 금액 직접입력"
                />
                <span className="shrink-0 text-[13px] font-semibold text-gray-600">만원 이상</span>
                <button
                  type="button"
                  disabled={appRole !== "parent" || !customThresholdManwon || draftAiReviewThreshold === aiReviewThreshold}
                  onClick={applyAiReviewThreshold}
                  className="h-11 shrink-0 rounded-xl bg-[var(--ac-600)] px-4 text-[13px] font-bold text-white disabled:bg-gray-300 active:scale-[0.98] transition-all"
                >
                  적용
                </button>
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-gray-400">
                예: 50 입력 시 50만원 이상 송금부터 AI가 확인해요.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {PROTECTION_LEVELS.map((item) => {
              const active = protectionLevel === item.level;
              const expanded = expandedLevel === item.level;
              return (
                <div
                  key={item.level}
                  className={`overflow-hidden rounded-2xl border transition-all duration-200 ${active ? "border-[var(--ac-300)] bg-[var(--ac-50)]" : "border-gray-100 bg-white"} ${expanded ? "shadow-sm" : ""}`}
                >
                  <button
                    type="button"
                    disabled={appRole !== "parent"}
                    onClick={() => { if (item.level !== protectionLevel) setPendingLevel(item.level); }}
                    className={`flex w-full items-center gap-3 p-4 text-left transition-all ${appRole === "parent" ? "hover:bg-black/[0.02] active:scale-[0.99]" : "cursor-default"}`}
                  >
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${active ? "bg-[var(--ac-500)] text-white" : "bg-gray-100 text-gray-500"}`}>Lv.{getProtectionDisplayLevel(item.level)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-[14px] font-bold text-gray-900">
                        {item.name}
                        {active && <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold text-[var(--ac-500)]">현재</span>}
                      </span>
                      <span className="mt-1 block text-[11px] leading-relaxed text-gray-500">{item.desc}</span>
                      <span className="mt-1.5 block text-[10px] leading-relaxed text-gray-400">권한: {item.permissions.join(" · ")}</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={`protection-detail-${item.level}`}
                    onClick={() => setExpandedLevel(expanded ? null : item.level)}
                    className="group flex w-full items-center justify-center gap-1.5 border-t border-gray-100/80 py-2.5 text-[11px] font-semibold text-gray-500 transition-colors hover:bg-white/70 hover:text-[var(--ac-600)]"
                  >
                    {expanded ? "상세 설명 접기" : "이 설정 자세히 보기"}
                    <svg viewBox="0 0 24 24" fill="none" className={`h-4 w-4 transition-transform duration-200 ${expanded ? "rotate-180" : "group-hover:translate-y-0.5"}`}>
                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {expanded && (
                    <div id={`protection-detail-${item.level}`} className="border-t border-gray-100 bg-white/80 px-4 pb-4 pt-4" style={{ animation: "fade-in .18s ease-out" }}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[13px] font-bold text-gray-900">이 설정에서는 이렇게 보호해요</p>
                        <span className="shrink-0 rounded-full bg-[var(--ac-50)] px-2 py-1 text-[9px] font-bold text-[var(--ac-600)]">Lv.{getProtectionDisplayLevel(item.level)} {item.name}</span>
                      </div>
                      <ol className="mt-3 flex flex-col gap-3">
                        {item.detailSteps.map((detail, index) => (
                          <li key={detail} className="flex items-start gap-3">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--ac-500)] text-[11px] font-bold text-white">{index + 1}</span>
                            <span className="pt-0.5 text-[12px] leading-relaxed text-gray-600">{detail}</span>
                          </li>
                        ))}
                      </ol>
                      <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-3.5 py-3">
                        <p className="text-[10px] font-bold text-amber-700">제한되는 권한</p>
                        <p className="mt-1 text-[11px] leading-relaxed text-amber-800">{item.limit}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3">
            <p className="text-[11px] leading-relaxed text-green-800">어떤 보호 범위를 선택해도 자녀에게 잔액과 전체 거래내역은 공개되지 않으며, 최종 결정권은 부모님에게 있어요.</p>
          </div>

          {/* 변경 재확인 — 보호 강도가 바뀌면 위험 판정 결과가 달라지므로 한 번 더 묻는다 */}
          {pendingLevel !== null && (
            <div className="fixed inset-0 z-[95] flex items-center justify-center px-6">
              <button
                aria-label="취소"
                onClick={() => setPendingLevel(null)}
                className="absolute inset-0 bg-black/40"
                style={{ animation: "fade-in .2s ease-out" }}
              />
              <div className="relative w-full max-w-[340px] rounded-2xl bg-white p-6 shadow-xl">
                <p className="text-[17px] font-bold text-gray-900">가족 보호 범위를 바꿀까요?</p>
                <p className="mt-3 text-[14px] leading-relaxed text-gray-600">
                  <span className="font-semibold text-gray-400">Lv.{getProtectionDisplayLevel(protectionLevel)} {protection.name}</span>
                  {" → "}
                  <span className="font-bold text-[var(--ac-600)]">Lv.{getProtectionDisplayLevel(pendingLevel)} {PROTECTION_LEVELS[pendingLevel].name}</span>
                </p>
                <p className="mt-2 text-[12px] leading-relaxed text-gray-400">
                  {PROTECTION_LEVELS[pendingLevel].desc}
                </p>
                <p className="mt-3 rounded-xl bg-gray-50 px-3 py-2.5 text-[11px] leading-relaxed text-gray-500">
                  변경 사실은 부모님과 자녀 앱 알림에 함께 남아요.
                </p>

                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPendingLevel(null)}
                    className="rounded-xl border border-gray-200 py-3 text-[15px] font-semibold text-gray-600 active:scale-[0.98] transition-all"
                  >
                    아니오
                  </button>
                  <button
                    onClick={confirmLevelChange}
                    className="rounded-xl bg-[var(--ac-500)] py-3 text-[15px] font-bold text-white active:scale-[0.98] transition-all"
                  >
                    네, 바꿀게요
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {step === "intro" && !isPaired && (
        <div className="flex flex-col gap-3">
          <div className={`bg-white rounded-2xl p-5 ${appRole === "child" ? "shadow-sm" : ""}`}>
            <p className="text-[15px] font-bold text-gray-900">네 가지 핵심 단계로 지켜드려요</p>
            <p className="text-[12px] text-gray-400 mt-1 mb-4">필요한 순간에만 순서대로 확인해요</p>
            {CORE_STAGES.map((item) => (
              <div key={item.step} className="flex items-start gap-3 mb-4 last:mb-0">
                <div className="w-7 h-7 rounded-full bg-[var(--ac-500)] text-white text-[13px] font-bold flex items-center justify-center shrink-0 mt-0.5">{item.step}</div>
                <div>
                  <p className="text-[14px] font-semibold text-gray-900">{item.title}</p>
                  <p className="text-[12px] text-gray-400 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
            <div className="mt-5 border-t border-gray-100 pt-4">
              <span className="inline-flex rounded-full bg-[var(--ac-50)] px-2.5 py-1 text-[10px] font-bold text-[var(--ac-700)]">선택 기능</span>
              <div className="mt-3 flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-[var(--ac-50)] flex items-center justify-center shrink-0 mt-0.5">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--ac-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M12 2v20M2 12h20" /></svg>
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-gray-900">원할 때 가족과 함께 확인해요</p>
                  <p className="text-[12px] text-gray-400 mt-0.5">부모님이 직접 보호 범위를 고르고, 은행이 달라도 자녀에게 최소 정보만 공유해요</p>
                </div>
              </div>
            </div>
          </div>

          <div className={`bg-white rounded-2xl p-5 ${appRole === "child" ? "shadow-sm" : ""}`}>
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
            { r: "parent" as const, label: "부모님", desc: "보호 범위를 직접 정하고 자녀와 연결해요" },
            { r: "child"  as const, label: "자녀",   desc: "부모님이 요청한 위험 상황만 함께 확인해요" },
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
              ? "딸 지혜님과 안심동행이 연결되었습니다.\n원할 때 위험 상황을 함께 확인할 수 있어요."
              : "어머니 김영순님과 안심동행이 연결되었습니다.\n어머니가 요청한 위험 상황을 함께 확인할 수 있어요."}
          </p>
          <button onClick={onExit} className="w-full py-3 rounded-xl text-[15px] font-semibold text-white bg-[var(--ac-500)] active:scale-[0.98] transition-all">
            홈으로 돌아가기
          </button>
        </div>
      )}

      {openEmergencyReceipt && (
        <div className="fixed inset-0 z-50">
          <button type="button" aria-label="접수 내역 닫기" onClick={() => setOpenEmergencyReceipt(null)} className="absolute inset-0 bg-black/40" />
          <div className="absolute bottom-0 left-0 right-0 mx-auto max-h-[88vh] w-full max-w-[430px] overflow-y-auto rounded-t-[28px] bg-[#fafbfe] px-5 pb-8 pt-4 shadow-2xl" style={{ animation: "sheet-up .28s cubic-bezier(.32,.72,0,1)" }}>
            <div className="mx-auto h-1 w-10 rounded-full bg-gray-200" />
            <div className="mt-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-[18px] font-bold text-gray-950">긴급 대응 접수 내역</p>
                <p className="mt-1 text-[11px] text-gray-400">{new Date(openEmergencyReceipt.createdAt).toLocaleString("ko-KR")}</p>
              </div>
              <span className="rounded-full bg-red-50 px-2 py-1 text-[9px] font-black text-red-600">MVP DEMO</span>
            </div>

            <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-4">
              <div className="flex items-center justify-between gap-3"><span className="text-[11px] text-gray-500">가상 접수번호</span><span className="text-[12px] font-bold text-gray-900">{openEmergencyReceipt.id}</span></div>
              <div className="mt-3 flex items-center justify-between gap-3"><span className="text-[11px] text-gray-500">현재 상태</span><span className="text-[11px] font-bold text-amber-700">기관 확인 중</span></div>
            </div>

            <div className="mt-3 rounded-2xl bg-white p-4">
              <p className="text-[13px] font-bold text-gray-900">피해 거래 정보</p>
              <div className="mt-3 flex flex-col gap-2 text-[11px]">
                <div className="flex justify-between gap-3"><span className="text-gray-400">송금 금액</span><span className="font-semibold text-gray-800">{openEmergencyReceipt.amount}{openEmergencyReceipt.amount === "확인 필요" ? "" : "원"}</span></div>
                <div className="flex justify-between gap-3"><span className="text-gray-400">수취 금융회사</span><span className="font-semibold text-gray-800">{openEmergencyReceipt.bank}</span></div>
                <div className="flex justify-between gap-3"><span className="text-gray-400">수취 계좌</span><span className="max-w-[220px] truncate font-semibold text-gray-800">{openEmergencyReceipt.account}</span></div>
              </div>
            </div>

            <div className="mt-3 rounded-2xl bg-white p-4">
              <p className="text-[13px] font-bold text-gray-900">기관별 처리 현황</p>
              <div className="mt-3 flex flex-col gap-3">
                {[
                  ["은행 지급정지 요청", "접수 완료", true],
                  ["112 피해 신고", "접수 완료", true],
                  ["피해구제 신청서", "전자서명 완료", true],
                  ["수취 금융회사 확인", "기관 확인 대기", false],
                  ["피해구제 심사", "심사 대기", false],
                ].map(([title, status, done]) => (
                  <div key={String(title)} className="flex items-center gap-3">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${done ? "bg-green-500 text-white" : "bg-amber-100 text-amber-700"}`}>{done ? "✓" : "•"}</span>
                    <span className="flex-1 text-[11px] font-semibold text-gray-800">{title}</span>
                    <span className={`text-[9px] font-bold ${done ? "text-green-600" : "text-amber-600"}`}>{status}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-[10px] leading-relaxed text-amber-700">접수 완료는 피해금 반환 완료를 의미하지 않아요. 은행과 경찰의 공식 연락을 계속 확인해 주세요.</p>
            <button type="button" onClick={() => setOpenEmergencyReceipt(null)} className="mt-4 h-13 w-full rounded-xl bg-blue-600 text-[14px] font-bold text-white">확인</button>
          </div>
        </div>
      )}

      {pendingDelete && (
        <div className="fixed inset-0 z-[70]">
          <button
            aria-label="삭제 확인 닫기"
            onClick={() => setPendingDelete(null)}
            className="absolute inset-0 bg-black/35"
            style={{ animation: "fade-in .18s ease-out" }}
          />
          <div
            className="absolute left-1/2 top-1/2 w-[calc(100%-48px)] max-w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-[28px] bg-white p-5 shadow-2xl"
            style={{ animation: "fade-in .18s ease-out" }}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--ac-100)] bg-[var(--ac-50)] shadow-sm">
                <img src="/ansim-ai-profile.png" alt="안심동행 AI" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ac-50)] px-2.5 py-1 text-[11px] font-bold text-[var(--ac-700)]">
                  <span className="h-2 w-2 rounded-full bg-[var(--ac-500)]" />
                  안심동행 AI
                </div>
                <p className="mt-2 text-[17px] font-extrabold text-gray-950">
                  {pendingDelete.kind === "chat" ? "상담 기록을 삭제할까요?" : "확인 기록을 삭제할까요?"}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-gray-500">
                  삭제한 기록은 다시 복구할 수 없어요.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="rounded-2xl bg-gray-100 py-3.5 text-[14px] font-bold text-gray-600 active:scale-[0.98] transition-transform"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="rounded-2xl bg-[var(--ac-600)] py-3.5 text-[14px] font-bold text-white active:scale-[0.98] transition-transform"
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 확인 기록 상세 — 부모님과 AI가 나눈 대화 전문 ──
           판단의 근거였던 대화를 나중에도 그대로 다시 볼 수 있어야 감사 기록이 된다. */}
      {openLog && (
        <div className="fixed inset-0 z-50">
          <button
            aria-label="닫기"
            onClick={() => setOpenLogId(null)}
            className="absolute inset-0 bg-black/40"
            style={{ animation: "fade-in .2s ease-out" }}
          />
          <div
            className="absolute bottom-0 left-0 right-0 mx-auto flex max-h-[85vh] w-full flex-col rounded-t-3xl bg-white"
            style={{ maxWidth: 430, animation: "sheet-up .28s cubic-bezier(.32,.72,0,1)" }}
          >
            <div className="shrink-0 px-5 pt-4 pb-3">
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[17px] font-bold text-gray-900">
                    {openLog.fraudTypeLabel || "위험 송금 확인"}
                  </p>
                  <p className="mt-1 truncate text-[13px] text-gray-400">
                    {openLog.amount.toLocaleString()}원 · {openLog.account}
                  </p>
                </div>
                <button onClick={() => setOpenLogId(null)} className="shrink-0 text-gray-400 active:scale-90 transition-transform">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-6 w-6">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {openLog.signals.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {openLog.signals.map((signal) => (
                    <span key={signal} className="rounded-full border border-red-100 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">
                      {signal}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto border-t border-gray-100 bg-[#fafbfe] px-4 py-4">
              <p className="mb-3 text-[12px] font-bold text-gray-400">부모님과 AI가 나눈 대화</p>
              <div className="flex flex-col gap-2.5">
                {openLog.conversation.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "ai" && (
                      <div className="mr-2 mt-0.5 h-7 w-7 shrink-0 overflow-hidden rounded-full border border-blue-100 bg-blue-50">
                        <img src="/ansim-ai-profile.png" alt="" className="h-full w-full object-cover" />
                      </div>
                    )}
                    <div className={`max-w-[78%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                      msg.role === "ai"
                        ? "rounded-tl-sm bg-white text-gray-800 border border-gray-100"
                        : "rounded-tr-sm bg-gray-200 text-gray-800"
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="shrink-0 border-t border-gray-100 px-5 py-4">
              <div className="flex flex-col gap-1.5">
                {[
                  ["위험 감지", fmtLogTime(openLog.raisedAt)],
                  ["AI 대화 확인", openLog.viewedAt ? fmtLogTime(openLog.viewedAt) : "열어보지 않음"],
                  ["내 판단", openLog.decidedAt
                    ? `${openLog.decision === "held" ? "보류" : "승인"} · ${fmtLogTime(openLog.decidedAt)}`
                    : "미처리"],
                ].map(([label, value]) => {
                  const empty = value === "열어보지 않음" || value === "미처리";
                  return (
                    <div key={label} className="flex items-center justify-between gap-3">
                      <span className="shrink-0 text-[12px] text-gray-400">{label}</span>
                      <span className={`truncate text-[12px] font-medium ${empty ? "text-gray-300" : "text-gray-700"}`}>{value}</span>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => setOpenLogId(null)}
                className="mt-4 w-full rounded-xl bg-[var(--ac-500)] py-3.5 text-[15px] font-bold text-white active:scale-[0.98] transition-transform"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
