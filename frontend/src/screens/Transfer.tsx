// 송금 화면 — 입력부터 AI 확인·피해 대응까지의 화면 흐름을 관리한다.
//   input → account → amount → checking → (success | db-warning | ai-chat → hold)
//   already-sent 는 별도 진입 (골든타임 사후 대응)
//
// 진행 중 상태는 이 파일이 소유하고, 사용자가 보류한 상담만 로컬 기록으로 저장한다.
// 자녀 앱과는 localStorage(ansimAlert·ansimPaired·ansimProtectionLevel 등 여러 키)로 연결된다.

import { useState, useEffect, useRef, useMemo } from "react";
import { takeTurn, FIRST_QUESTION, type ChatMessage, type OfficialContent } from "../api/guardian";
import { BankAvatar, BankLogo, PageHeader, RECIPIENT_ICONS, shortBank } from "../shared/ui";
import {
  MY_ACCOUNTS, KNOWN_RECIPIENTS, BLACKLISTED_ACCOUNTS, BANKS, BROKERAGES, DEMO_ALERT, lookupHolder,
  fmtAccount, fmtAmt, parseAmt, runIntentPrefilter, isMyAccount, nowTime,
  type TransferStep,
} from "../shared/data";
import {
  readIntentChatSession,
  saveIntentChatSession,
  type IntentChatSession,
} from "../shared/intentChat";
import officialContacts from "../../../shared/official-contacts.json";
import { fetchRiskScore, type RiskResult } from "../api/riskScore";
import type { BehaviorSignals } from "../shared/behavior";
import { getProtectionPolicy, useAiReviewThreshold, useProtectionLevel } from "../shared/protection";
import { saveEmergencyReceipt as saveEmergencyReceiptRecord } from "../shared/emergencyReceipt";
import { startGlobalCooldown } from "../shared/cooldown";
import { formatAiSpeechText, isStructuredAiMessage, ReadableAiMessage } from "../shared/ReadableAiMessage";

type EmergencyStage = "review" | "submitting" | "submitted";

// 골든타임 화면의 "은행" 버튼 번호 — 공식 연락처 정본(official-contacts.json) 하나만 보고 걸도록,
// 여기서도 하드코딩하지 않고 같은 데이터를 참조한다.
const BANK_SUPPORT_PHONE = officialContacts.phones.find((p) => p.name === "한결은행")?.value ?? "15885000";

// ── 보안 분석 결과 카드 ─────────────────────────────────────────────────────
const GRADE_STYLE = {
  safe:    { text: "text-emerald-700", meter: "bg-emerald-500", chip: "text-emerald-700 border-emerald-100 bg-emerald-50" },
  caution: { text: "text-amber-700",   meter: "bg-amber-500",   chip: "text-amber-700 border-amber-100 bg-amber-50" },
  warning: { text: "text-orange-700",  meter: "bg-orange-500",  chip: "text-orange-700 border-orange-100 bg-orange-50" },
  danger:  { text: "text-red-700",     meter: "bg-red-500",     chip: "text-red-700 border-red-100 bg-red-50" },
} as const;

function RiskGradeCard({
  result, onProceed, freezeSecsLeft, onSkipFreeze,
}: {
  result: RiskResult;
  onProceed: () => void;
  freezeSecsLeft: number | null;
  onSkipFreeze: () => void;
}) {
  const s = GRADE_STYLE[result.gradeColor];
  const isHigh = result.grade === "C" || result.grade === "D";

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-[28px] border border-[var(--ac-100)] bg-gradient-to-br from-white via-[var(--ac-50)] to-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white bg-white shadow-sm">
            <img src="/ansim-ai-profile.png" alt="안심동행 AI" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[var(--ac-700)] shadow-sm">
              <span className="h-2 w-2 rounded-full bg-[var(--ac-500)]" />
              안심동행 AI 분석 결과
            </div>
            <p className="mt-1 text-[12px] text-gray-500">거래 정보와 평소 패턴을 함께 확인했어요</p>
          </div>
        </div>

        {/* 등급 배지 + 점수 */}
        <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-[64px] w-[64px] items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--ac-500)] to-[var(--ac-300)] shadow-sm">
              <span className="text-[34px] font-black text-white leading-none">{result.grade}</span>
            </div>
            <div>
              <p className={`text-[25px] font-black leading-tight ${s.text}`}>{result.gradeLabel}</p>
              <p className="text-[12px] text-gray-400">종합 위험 점수 {result.score}점 / 100점</p>
            </div>
          </div>

          {/* 점수 바 */}
          <div className="mt-4 flex flex-col gap-2.5">
            {[
              { label: "행동 감지", val: result.behaviorScore },
              { label: "송금 신호", val: result.transferSignalScore },
            ].map(({ label, val }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-[12px] text-gray-500 w-[64px] shrink-0">{label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div className={`h-full ${s.meter} rounded-full`} style={{ width: `${Math.min(100, val)}%` }} />
                </div>
                <span className="w-8 text-right text-[12px] font-bold text-gray-700">{val}점</span>
              </div>
            ))}
          </div>
        </div>

        {/* 감지 항목 */}
        {result.reasons.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {result.reasons.map((r) => (
              <span key={r} className={`rounded-full border px-2.5 py-1 text-[12px] font-bold ${s.chip}`}>
                {isHigh ? "주의 · " : ""}{r}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 액션 버튼
          B등급도 위험 신호가 감지된 상태다 — "확인 후 송금하기" 한 번으로 의도 분석을 건너뛰고
          바로 완료되던 예전 동작은 사실상 우회로였다. B·C 모두 AI 확인 대화를 반드시 거치게 한다. */}
      {result.grade === "A" ? (
        <div className="flex items-center justify-center gap-2 py-1.5 text-green-600">
          <div className="w-3.5 h-3.5 rounded-full border-2 border-green-300 border-t-green-600 animate-spin" />
          <span className="text-[13px]">안전 확인 — 송금을 진행합니다</span>
        </div>
      ) : result.grade === "B" || result.grade === "C" ? (
        <>
          <button
            onClick={onProceed}
            className={`w-full py-3.5 rounded-xl text-[15px] font-bold text-white active:scale-[0.98] transition-all ${
              result.grade === "B" ? "bg-amber-500" : "bg-[var(--ac-500)]"
            }`}
          >
            AI와 거래 목적 확인하기
          </button>
          <p className="text-[12px] text-gray-400 text-center">위험 신호가 감지됐어요 — AI가 목적을 여쭤볼게요</p>
        </>
      ) : (
        /* D등급 — 송금을 5분 정지시키고 그 시간에 AI가 목적을 확인한다 */
        <div className="rounded-[28px] border border-[var(--ac-100)] bg-gradient-to-br from-[var(--ac-50)] via-white to-[var(--ac-50)] p-5 shadow-sm flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-white bg-white shadow-sm">
            <img src="/ansim-ai-profile.png" alt="안심동행 AI" className="h-full w-full object-cover" />
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] font-bold text-[var(--ac-700)] shadow-sm">
            <span className="h-2 w-2 rounded-full bg-[var(--ac-500)]" />
            송금 5분 정지
          </div>
          {freezeSecsLeft !== null && (
            <div className="rounded-2xl bg-white px-5 py-3 text-[40px] font-black text-[var(--ac-700)] font-mono tracking-[3px] leading-none shadow-sm">
              {String(Math.floor(freezeSecsLeft / 60)).padStart(2, "0")}:{String(freezeSecsLeft % 60).padStart(2, "0")}
            </div>
          )}
          <p className="text-center text-[13px] leading-relaxed text-gray-600">
            매우 높은 위험 신호가 감지됐어요.<br />정지된 동안 안심동행 AI가 송금 목적을 확인할게요.
          </p>
          <div className="flex items-center gap-2 pt-1 text-[var(--ac-600)]">
            <div className="w-3.5 h-3.5 rounded-full border-2 border-[var(--ac-200)] border-t-[var(--ac-600)] animate-spin" />
            <span className="text-[12px] font-semibold">안심동행 AI 연결 중</span>
          </div>
          <button onClick={onSkipFreeze} className="text-[11px] text-gray-400 underline underline-offset-2 active:scale-95 transition-transform">
            데모 건너뛰기 →
          </button>
        </div>
      )}
    </div>
  );
}

const TITLES: Record<TransferStep, string> = {
  input: "어디로 보낼까요?", account: "어떤 계좌로 보낼까요?", amount: "얼마를 보낼까요?",
  confirm: "", checking: "송금 중", success: "송금 완료",
  "db-warning": "위험 계좌 감지", "ai-chat": "안심동행 AI",
  hold: "확인 요청 중", "already-sent": "긴급 대응 ⚡",
};

export default function Transfer({
  onExit, accounts = MY_ACCOUNTS, resumeSessionId = null, resumeToHold = false, onResumeHandled, initialStep = "input",
  behaviorSignals = { historyVisits: 0, verifyVisited: false, savingsEarlyClose: 0, limitIncreased: 0 },
  onSuccess, defaultFromIdx = 0, dailyLimit = Number.POSITIVE_INFINITY, dailyTransferred = 0,
}: {
  onExit: () => void;
  accounts?: typeof MY_ACCOUNTS;
  resumeSessionId?: string | null;
  resumeToHold?: boolean;
  onResumeHandled?: () => void;
  initialStep?: "input" | "already-sent";
  behaviorSignals?: BehaviorSignals;
  onSuccess?: (fromIdx: number, amount: number, recipientName: string, toAccount: string) => void;
  defaultFromIdx?: number;
  dailyLimit?: number;
  dailyTransferred?: number;
}) {
  const [step, setStep] = useState<TransferStep>(initialStep);
  const [account, setAccount] = useState("");
  const [bank, setBank]       = useState("");
  const [name, setName]       = useState("");
  const [amt, setAmt]         = useState("");
  const [bankOpen, setBankOpen] = useState(false);
  const [bankTab, setBankTab] = useState<"은행" | "증권사">("은행");
  const [fromIdx, setFromIdx] = useState(defaultFromIdx);   // 출금 계좌 (탭하면 다음 계좌로 순환)

  // 페어링 전에는 가족 확인 옵션만 비활성화되고 1~4단계 안전 기능은 그대로 작동한다.
  // 가족이 연결돼야 성립하는 기능이므로, 연결 전에는 평범한 은행 송금 화면이어야 한다.
  const [paired, setPaired] = useState(() => localStorage.getItem("ansimPaired") === "true");

  useEffect(() => {
    const syncPairing = () => setPaired(localStorage.getItem("ansimPaired") === "true");
    window.addEventListener("ansim-paired", syncPairing);
    window.addEventListener("storage", syncPairing);
    return () => {
      window.removeEventListener("ansim-paired", syncPairing);
      window.removeEventListener("storage", syncPairing);
    };
  }, []);

  // 키패드 입력 — 원본 숫자열을 다루고 표시만 콤마를 넣는다
  const pressKey = (k: string) => {
    const digits = amt.replace(/\D/g, "");
    setAmt(fmtAmt(k === "back" ? digits.slice(0, -1) : digits + k));
  };

  // AI 대화 상태
  const [messages, setMessages]   = useState<ChatMessage[]>([]);
  const [input, setInput]         = useState("");
  const [turnCount, setTurnCount] = useState(0);   // 부모님이 답한 횟수
  const [chatDone, setChatDone]   = useState(false);
  const [isTyping, setIsTyping]   = useState(false);
  const [fallback, setFallback]   = useState(false); // LLM 실패로 폴백 사용 중
  const [riskLabels, setRiskLabels] = useState<string[]>([]);
  const [thecheatHit, setThecheatHit] = useState<{ reportCount: number; scamTypes: string[]; lastReported: string } | null>(null);
  const [fraudTypeLabel, setFraudTypeLabel] = useState("");
  const [analysisHold, setAnalysisHold] = useState(false);
  const [speakingMessageIndex, setSpeakingMessageIndex] = useState<number | null>(null);
  // 사기 유형이 확정되면 금감원 사례·영상을 함께 보여준다 (서버가 유형별로 미리 매핑)
  const [official, setOfficial] = useState<OfficialContent | null>(null);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const [protectionLevel] = useProtectionLevel();
  const [aiReviewThreshold] = useAiReviewThreshold();
  const protectionPolicy = getProtectionPolicy(protectionLevel);
  const [resumeNotice, setResumeNotice] = useState(false);   // 저장한 상담을 다시 연 상태
  const [intentSessionId, setIntentSessionId] = useState<string | null>(null);
  const [emergencyStage, setEmergencyStage] = useState<EmergencyStage>("review");
  const [emergencyConsent, setEmergencyConsent] = useState(false);
  const [emergencyReceipt, setEmergencyReceipt] = useState("");
  const [emergencyAuthOpen, setEmergencyAuthOpen] = useState(false);
  const [emergencyAuthVerifying, setEmergencyAuthVerifying] = useState(false);
  const [reliefSigned, setReliefSigned] = useState(false);
  const [evidenceSaved, setEvidenceSaved] = useState(false);
  const [policeReportDone, setPoliceReportDone] = useState(false);
  const [policeDraftOpen, setPoliceDraftOpen] = useState(false);
  const [policeDraftConfirmed, setPoliceDraftConfirmed] = useState(false);
  const [policeDraft, setPoliceDraft] = useState("오늘 확인되지 않은 상대방의 안내를 받고 송금했습니다. 송금 직후 사기 의심 정황을 확인했으며, 지급정지와 피해 신고를 요청합니다. 상대방 연락처와 대화 기록, 송금확인증을 보관하고 있습니다.");
  const [safetyConfirmed, setSafetyConfirmed] = useState(false);
  const [bankFollowupConfirmed, setBankFollowupConfirmed] = useState(false);
  const [reliefDocumentOpen, setReliefDocumentOpen] = useState(false);
  const [reliefSignatureNotice, setReliefSignatureNotice] = useState(false);
  const [showEmergencyStatus, setShowEmergencyStatus] = useState(false);
  const [emergencyReceiptSaved, setEmergencyReceiptSaved] = useState(false);
  const reliefDocumentRef = useRef<HTMLDivElement>(null);
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // 행동 감지 — Transfer 내부 신호
  const [backPresses, setBackPresses]   = useState(0);
  const [riskResult, setRiskResult]     = useState<RiskResult | null>(null);
  const [checkPhase, setCheckPhase]     = useState<"analyzing" | "result">("analyzing");
  const [analyzeStep, setAnalyzeStep]   = useState(0);
  const [freezeSecsLeft, setFreezeSecsLeft] = useState<number | null>(null);
  const sessionStartRef = useRef<number>(Date.now());

  const chatEndRef = useRef<HTMLDivElement>(null);
  const behaviorSignalsRef = useRef(behaviorSignals);
  behaviorSignalsRef.current = behaviorSignals; // 렌더마다 갱신 — 클로저 stale 방지
  const time = nowTime();

  const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  const stopAiSpeech = () => {
    if (speechSupported) window.speechSynthesis.cancel();
    speechUtteranceRef.current = null;
    setSpeakingMessageIndex(null);
  };

  const toggleAiSpeech = (text: string, messageIndex: number, display?: ChatMessage["display"]) => {
    if (!speechSupported) return;
    if (speakingMessageIndex === messageIndex) {
      stopAiSpeech();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(formatAiSpeechText(text, display !== "plain"));
    utterance.lang = "ko-KR";
    utterance.rate = 0.92;
    utterance.pitch = 1;
    utterance.onend = () => {
      if (speechUtteranceRef.current !== utterance) return;
      speechUtteranceRef.current = null;
      setSpeakingMessageIndex(null);
    };
    utterance.onerror = utterance.onend;
    speechUtteranceRef.current = utterance;
    setSpeakingMessageIndex(messageIndex);
    window.speechSynthesis.speak(utterance);
  };

  // ── 실시간 위험 미리보기 (금액 입력 중) ──
  const liveRisk = useMemo(() => {
    const clean = account.replace(/\D/g, "");
    const value = parseAmt(amt);
    if (!clean && !value) return null;

    if (isMyAccount(account))
      return { score: 0, label: "내 계좌", msg: "본인 명의 계좌 — 확인 없이 바로 보내드려요" };

    if (BLACKLISTED_ACCOUNTS.some((b) => clean.length >= 7 && clean.startsWith(b.slice(0, 7))))
      return { score: 100, label: "DB 경고", msg: "신고된 계좌예요 — 즉시 차단됩니다" };

    const known = KNOWN_RECIPIENTS.find(
      (k) => (clean.length >= 8 && clean.startsWith(k.account.slice(0, 8))) || name === k.name
    );
    let score = 0;
    if (!known && clean.length >= 8) score += 25;
    if (value >= 300000) score += 10;
    if (value >= 1000000) score += 15;
    if (value >= 3000000) score += 20;

    if (value >= aiReviewThreshold && score >= 35)
      return { score, label: "AI 확인 필요", msg: `${aiReviewThreshold.toLocaleString()}원 이상 — AI가 송금 목적을 여쭤볼게요` };

    return { score, label: "정상", msg: "정상 거래로 분석됩니다" };
  }, [account, amt, name, aiReviewThreshold]);

  // ── Effects ──
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  useEffect(() => {
    if (!resumeSessionId) return;
    const session = readIntentChatSession(resumeSessionId);
    onResumeHandled?.();
    if (!session) return;

    setIntentSessionId(session.id);
    setAccount(session.transfer.account);
    setBank(session.transfer.bank);
    setName(session.transfer.name);
    setAmt(session.transfer.amount);
    setFromIdx(Math.min(session.transfer.fromIdx, accounts.length - 1));
    // 이어보기 안내는 대화 기록이 아니라 시스템 알림이다.
    // 메시지로 넣으면 결론·공식 자료보다 뒤에 붙어 순서가 뒤집힌다.
    setMessages(session.messages);
    setResumeNotice(true);
    setTurnCount(session.turnCount);
    setRiskLabels(session.riskLabels);
    setFraudTypeLabel(session.fraudTypeLabel);
    setFallback(session.fallback);
    // 분석이 끝난 상담이면 결론·공식 자료를 그대로 되살린다.
    // 대화를 이어가더라도 앞서 안내받은 내용이 사라지면 안 된다.
    // analysisDone이 없던 예전 저장본도 analysisHold가 있으면 이미 결론까지 나온 상담이다.
    // 이를 진행 중 상담으로 복원하면 다음 답변을 새 판정으로 오인해 5분 냉각이 다시 시작된다.
    setChatDone(session.analysisDone ?? session.analysisHold ?? false);
    setAnalysisHold(session.analysisHold ?? false);
    setOfficial(session.official ?? null);
    // 냉각 중 저장한 상담이면 남은 시간도 그대로 되살린다 — 안 그러면 그 사이 보호 단계를
    // 낮춰서 재개하는 것만으로 냉각·가족 확인 게이트를 건너뛸 수 있었다.
    if (session.analysisHold) {
      setFreezeSecsLeft(session.freezeSecsLeft ?? null);
      if (session.freezeSecsLeft) startGlobalCooldown(session.freezeSecsLeft);
    }
    setPlayingVideo(null);
    setInput("");
    setStep(resumeToHold ? "hold" : "ai-chat");
  }, [resumeSessionId, resumeToHold, accounts.length, onResumeHandled]);

  // 계좌번호가 확정되면 예금주를 조회해 자동으로 채운다 (실제 은행 이체 흐름과 동일)
  useEffect(() => {
    if (step === "amount") setName(lookupHolder(account));
  }, [step, account]);

  // 계좌번호가 아는 수취인과 맞으면 은행·이름을 자동으로 채운다
  // (실서비스의 예금주 조회 자리 — 데모에서는 로컬 목록으로 대체)
  useEffect(() => {
    if (step !== "account") return;
    const clean = account.replace(/\D/g, "");
    if (clean.length < 8) return;
    const hit =
      MY_ACCOUNTS.find((m) => clean.includes(m.account.slice(0, 8))) ??
      KNOWN_RECIPIENTS.find((k) => clean.includes(k.account.slice(0, 8)));
    if (hit) { setBank(hit.bank); setName(hit.name); }
  }, [account, step]);

  // 분석 완료 → 2단계 행동 감지 + 3단계 내부의 빠른 송금 신호 → 사전 등급 표시
  // 1~4단계 안전 기능은 가족 연결과 무관하게 항상 동작한다.
  // 가족 연결이 필요한 것은 선택 기능인 가족 확인·권한 위임뿐이다.
  useEffect(() => {
    if (step !== "checking") return;

    // 뒤로가기 등으로 이 단계를 벗어나면 아래 지연 콜백들이 더 이상 화면 상태를 바꾸지 못하게 막는다.
    // (분석 API가 늦게 응답해도, 이미 떠난 화면에 몰래 결제·정지를 걸지 않기 위함)
    let cancelled = false;

    setCheckPhase("analyzing");
    setAnalyzeStep(0);
    setRiskResult(null);
    setThecheatHit(null); // 이전 검사에서 남은 신고 정보가 이번 화면에 잘못 뜨지 않도록 초기화

    // 즉결 처리 (API 불필요)
    if (isMyAccount(account)) { setStep("success"); return; }
    const amountValue = parseAmt(amt);
    const localRisk = runIntentPrefilter(account, amountValue, name);
    if (localRisk === "db-warning") { setStep("db-warning"); return; }
    if (amountValue < aiReviewThreshold) { setStep("success"); return; }

    // 분석 단계 애니메이션 (3단계 × 900ms)
    const pt1 = setTimeout(() => setAnalyzeStep(1), 900);
    const pt2 = setTimeout(() => setAnalyzeStep(2), 1800);

    const sessionSec = Math.floor((Date.now() - sessionStartRef.current) / 1000);
    const clean = account.replace(/\D/g, "");
    const known = KNOWN_RECIPIENTS.find(
      (k) => (clean.length >= 8 && clean.startsWith(k.account.slice(0, 8))) || name === k.name,
    );
    const MIN_DISPLAY = 2700;
    const startTs = Date.now();

    const goAiChat = () => {
      if (cancelled) return;
      setMessages([{ role: "ai", text: FIRST_QUESTION }]);
      setTurnCount(0); setChatDone(false);
      setStep("ai-chat");
    };

    fetchRiskScore({
      counterparty: { account },
      behavior: { ...behaviorSignalsRef.current, backPresses, sessionSeconds: sessionSec },
      transaction: {
        amount: amountValue,
        isKnownRecipient: !!known,
        isMyAccount: false,
        hourOfDay: new Date().getHours(),
      },
    }).then((result) => {
      const delay = Math.max(0, MIN_DISPLAY - (Date.now() - startTs));
      setTimeout(() => {
        if (cancelled) return;
        // 1층(상대방 검증)이 더치트 신고 이력으로 즉시 차단한 경우다. 이미 신고가 확정된
        // 계좌라 대화로 목적을 물어볼 필요가 없다 — 점수 기반 D등급과 달리 바로 db-warning으로 간다.
        if (result.thecheat) {
          setThecheatHit(result.thecheat);
          setStep("db-warning");
          return;
        }
        setRiskResult(result);
        setCheckPhase("result");
        if (result.grade === "A") setTimeout(() => { if (!cancelled) setStep("success"); }, 1500);
        else if (result.grade === "D") {
          // 5분 냉각을 걸어두고 곧바로 의도 분석 대화로 넘어간다.
          // 냉각은 송금을 막는 장치이고, 그 시간을 AI 대화로 채운다.
          setFreezeSecsLeft(300);
          startGlobalCooldown(300); // 화면을 벗어나도(뒤로가기·홈) 앱 전체에서 정지가 유지된다
          setRiskLabels((prev) => (prev.length ? prev : result.reasons));
          setTimeout(goAiChat, 2200);
        }
      }, delay);
    }).catch(() => {
      // API 장애 시 기존 로직으로 폴백
      const delay = Math.max(0, MIN_DISPLAY - (Date.now() - startTs));
      setTimeout(() => {
        if (cancelled) return;
        const r = runIntentPrefilter(account, parseAmt(amt), name);
        if (r === "success") setStep("success");
        else if (r === "db-warning") setStep("db-warning");
        else goAiChat();
      }, delay);
    });

    return () => { cancelled = true; clearTimeout(pt1); clearTimeout(pt2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // D등급 5분 정지 카운트다운
  useEffect(() => {
    if (freezeSecsLeft === null || freezeSecsLeft <= 0) return;
    const t = setTimeout(() => setFreezeSecsLeft((s) => (s !== null ? s - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [freezeSecsLeft]);

  // D등급 카운트다운 종료 → 자동 홀드 (우회 불가)
  useEffect(() => {
    if (freezeSecsLeft !== 0 || riskResult?.grade !== "D") return;
    setRiskLabels((prev) => prev.length ? prev : (riskResult?.reasons ?? []));
    const t = setTimeout(() => {
      // 수동 보류(requestFamilyConfirmation)와 똑같이 상담을 저장해야 sessionId가 남는다.
      // 저장을 빼먹으면 Guardian의 "확인하러 가기"가 이 자동 보류 건을 못 찾는다.
      saveCurrentIntentChat();
      setStep("hold");
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freezeSecsLeft]);

  // 송금 성공 시 잔액 차감 콜백
  // 쿨다운(freezeSecsLeft)이 아직 남아 있다면 어떤 경로로 "success"에 도달했더라도
  // 실제 송금(onSuccess, 잔액 차감)은 절대 실행하지 않는다 — 우회 불가 정지는 화면 전환이
  // 아니라 실제로 돈이 움직이는 이 지점에서 강제한다.
  useEffect(() => {
    if (step !== "success") return;
    if (freezeSecsLeft !== null && freezeSecsLeft > 0) {
      setStep("hold");
      return;
    }
    onSuccess?.(fromIdx, parseAmt(amt), name, account);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // hold 화면 도달 시 자녀 탭에 알림 공유 — 페어링 전에는 알림을 받을 자녀가 없으므로 쓰지 않는다.
  useEffect(() => {
    if (step !== "hold" || !paired) return;
    localStorage.setItem("ansimAlert", JSON.stringify({
      amount: parseAmt(amt),
      account: `${bank} ${account}`,
      bank,
      risk: "HIGH",
      signals: riskLabels.length ? riskLabels : DEMO_ALERT.signals,
      conversation: messages,
      sessionId: intentSessionId,
      protectionLevel,
      time,
      _ts: Date.now(),
    }));
    window.dispatchEvent(new Event("ansim-alert"));
  }, [step, intentSessionId, protectionLevel]);

  // ── Handlers ──
  const reset = () => {
    setStep("input");
    setAccount(""); setBank(""); setName(""); setAmt(""); setBankOpen(false);
    setMessages([]); setInput(""); setTurnCount(0); setChatDone(false);
    setIsTyping(false); setFallback(false); setRiskLabels([]); setFraudTypeLabel(""); setAnalysisHold(false); setOfficial(null); setPlayingVideo(null); setResumeNotice(false);
    setIntentSessionId(null);
    setEmergencyStage("review"); setEmergencyConsent(false); setEmergencyReceipt("");
    setEmergencyAuthOpen(false); setEmergencyAuthVerifying(false);
    setReliefSigned(false); setEvidenceSaved(false);
    setPoliceReportDone(false); setPoliceDraftOpen(false); setPoliceDraftConfirmed(false); setSafetyConfirmed(false); setBankFollowupConfirmed(false); setShowEmergencyStatus(false); setEmergencyReceiptSaved(false);
    setReliefDocumentOpen(false);
    setReliefSignatureNotice(false);
    setBackPresses(0); setRiskResult(null); setCheckPhase("analyzing"); setAnalyzeStep(0);
    setFreezeSecsLeft(null);
    sessionStartRef.current = Date.now();
  };

  const goHome = () => { reset(); onExit(); };

  const saveCurrentIntentChat = () => {
    const now = new Date().toISOString();
    const existing = intentSessionId ? readIntentChatSession(intentSessionId) : null;
    const session: IntentChatSession = {
      schemaVersion: 1,
      id: existing?.id ?? `intent-${Date.now()}`,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      transfer: { account, bank, name, amount: amt, fromIdx },
      messages,
      turnCount,
      riskLabels,
      fraudTypeLabel,
      fallback,
      analysisDone: chatDone,
      analysisHold,
      official,
      freezeSecsLeft,
    };
    saveIntentChatSession(session);
    setIntentSessionId(session.id);
    return session;
  };

  const pauseIntentChat = () => {
    saveCurrentIntentChat();
    goHome();
  };

  const requestFamilyConfirmation = () => {
    saveCurrentIntentChat();
    setStep("hold");
  };

  const submitEmergencyResponse = () => {
    if (!emergencyConsent || emergencyStage !== "review") return;
    setEmergencyStage("submitting");
    window.setTimeout(() => {
      setEmergencyReceipt(`HG-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${String(Date.now()).slice(-6)}`);
      setEmergencyStage("submitted");
    }, 900);
  };

  const verifyEmergencyIdentity = () => {
    if (emergencyAuthVerifying) return;
    setEmergencyAuthVerifying(true);
    window.setTimeout(() => {
      setEmergencyAuthVerifying(false);
      setEmergencyAuthOpen(false);
      submitEmergencyResponse();
    }, 650);
  };

  const printReliefDocument = () => {
    const documentHtml = reliefDocumentRef.current?.outerHTML;
    if (!documentHtml) return;
    const printWindow = window.open("", "_blank", "width=900,height=1100");
    if (!printWindow) return;
    printWindow.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>피해구제신청서</title><style>body{margin:0;background:#fff;font-family:Arial,'Malgun Gothic',sans-serif;color:#111}.relief-pdf-page{width:210mm;min-height:297mm;box-sizing:border-box;margin:0 auto;padding:14mm}.no-print{display:none!important}@page{size:A4;margin:0}table{border-collapse:collapse;width:100%}td,th{border:1px solid #222;padding:7px;font-size:11px;vertical-align:middle}h1{text-align:center;font-size:24px;margin:8px 0 20px}.pdf-note{font-size:10px;color:#555}.pdf-section-title{font-size:12px;font-weight:700;margin:14px 0 6px}.signature-mark{font-family:cursive;font-size:22px;color:#1d4ed8;font-weight:700}</style></head><body>${documentHtml}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 250);
  };

  const saveEmergencyReceipt = () => {
    if (!emergencyReceipt) return;
    saveEmergencyReceiptRecord({
      id: emergencyReceipt,
      createdAt: new Date().toISOString(),
      amount: amt || "확인 필요",
      bank: bank || "확인 필요",
      account: account || "확인 필요",
      status: "processing",
    });
    setEmergencyReceiptSaved(true);
  };

  /** 목록에서 계좌를 고르면 정보를 채우고 금액 화면으로 */
  const pick = (n: string, b: string, acc: string) => {
    setName(n); setBank(b); setAccount(fmtAccount(acc)); setStep("amount");
  };

  // 최근 보낸 적 없는 계좌인가 — 실제 은행이 보내기 직전에 띄우는 안내와 같은 성격
  const isNewRecipient = useMemo(() => {
    const clean = account.replace(/\D/g, "");
    if (clean.length < 8) return false;
    if (isMyAccount(account)) return false;
    return !KNOWN_RECIPIENTS.some((k) => clean.includes(k.account.slice(0, 8)));
  }, [account]);

  const accountReady = account.replace(/\D/g, "").length >= 8 && !!bank;
  const amountValue = parseAmt(amt);
  const hasDailyLimit = Number.isFinite(dailyLimit);
  const remainingDailyLimit = hasDailyLimit ? Math.max(dailyLimit - dailyTransferred, 0) : Number.POSITIVE_INFINITY;
  const exceedsDailyLimit = hasDailyLimit && amountValue > remainingDailyLimit;
  const canSubmit = accountReady && amountValue > 0 && !exceedsDailyLimit;
  const completedEmergencyFollowups = [reliefSigned, policeReportDone, evidenceSaved, safetyConfirmed, bankFollowupConfirmed].filter(Boolean).length;
  const reliefPdfScale = typeof window === "undefined" ? 0.57 : Math.min(0.57, Math.max(0.42, (window.innerWidth - 24) / 680));

  // 뒤로가기 — 단계별로 한 칸씩 (횟수는 행동 신호로 수집)
  const goBack = () => {
    setBackPresses((p) => p + 1);
    if (step === "account") { setStep("input"); setBankOpen(false); }
    else if (step === "amount") setStep("account");
    else if (step === "confirm") setStep("amount");
    else goHome();
  };

  // 3단계 AI 의도 분석 — 이전 거래 패턴·RAG·Gemini 신호를 결합하고 규칙이 보류 판정
  const handleSend = async () => {
    // 위험 판정이 끝나도 상담은 끝나지 않는다.
    // chatDone은 분석 결과가 나온 상태일 뿐, 추가 질문을 막는 조건이 아니다.
    if (!input.trim() || isTyping) return;

    // 요청을 보낼 때의 분석 완료 여부를 보존한다. 응답을 기다리는 사이에도 이 상담이
    // '새 위험 판정'인지 '완료된 상담의 후속 대화'인지 구분할 수 있어야 한다.
    const analysisWasAlreadyDone = chatDone;
    const history: ChatMessage[] = [...messages, { role: "user", text: input.trim() }];
    const turn = turnCount + 1;

    setMessages(history);
    setInput("");
    setTurnCount(turn);
    setIsTyping(true);
    setResumeNotice(false);   // 새 답변이 들어오면 이어보기 안내는 내린다

    const verdict = await takeTurn(
      {
        userId: "demo-parent-01",
        sourceAccount: accounts[fromIdx].account,
        occurredAt: new Date(sessionStartRef.current).toISOString(),
        amount: parseAmt(amt), recipientName: name, account, bank,
        isFirstTransfer: isNewRecipient,
        patternRiskScore: liveRisk?.score ?? 0,
      },
      history,
      turn,
      {
        resumed: intentSessionId !== null,
        analysisDone: analysisWasAlreadyDone,
        analysisHold,
        fraudTypeLabel,
        riskLabels,
      },
    );

    setIsTyping(false);
    setFallback(verdict.fallback);
    if (verdict.risk.labels.length) setRiskLabels(verdict.risk.labels);
    const suspectedType = verdict.analysis?.suspected_fraud_type;
    if (suspectedType && !["none", "unknown"].includes(suspectedType.code)) {
      setFraudTypeLabel(suspectedType.label);
    }
    setOfficial(verdict.analysis?.official_content ?? null);
    const middlewareRoute = verdict.middleware?.route;
    const display = middlewareRoute && middlewareRoute !== "RISK" ? "plain" : "structured";
    setMessages((p) => [...p, { role: "ai", text: verdict.message, display }]);

    // 3단계 의도 분석 결과를 표시하고, 가족 확인은 사용자가 선택할 때만 별도로 연결한다.
    if (verdict.done) {
      setChatDone(true);
      setAnalysisHold(verdict.hold);
      // 냉각은 최초 위험 판정에만 적용한다. 저장된 상담에서 이어서 질문한 답변이
      // 같은 hold 판정을 돌려줘도 이미 시작했던 5분을 다시 채우지 않는다.
      if (!analysisWasAlreadyDone && verdict.hold && protectionPolicy.delaySeconds > 0) {
        setFreezeSecsLeft((current) => Math.max(current ?? 0, protectionPolicy.delaySeconds));
        startGlobalCooldown(protectionPolicy.delaySeconds);
      }
    }
  };

  // ══════════════════════════════════════════════════════════════════════
  return (
    <div className={`flex flex-col ${step === "amount" || step === "confirm" ? "gap-0" : "gap-4"} ${step === "ai-chat" ? "min-h-[calc(100dvh-158px)]" : ""}`}>
      {/* 금액·확인 화면은 가운데 큰 글씨가 제목 역할을 하므로 뒤로가기만 둔다 */}
      {step === "amount" || step === "confirm" ? (
        <button onClick={goBack} className="w-9 h-9 -ml-1 flex items-center text-gray-500 active:scale-90 transition-transform">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
      ) : (
        <PageHeader title={step === "checking" ? "거래 분석 중" : TITLES[step]} onBack={goBack} />
      )}

      {/* ── 1단계: 어디로 보낼까요 ── */}
      {step === "input" && (
        <div className="flex flex-col gap-3">

          {/* 계좌번호 입력 → 전용 페이지로 */}
          <button
            onClick={() => setStep("account")}
            className="bg-white rounded-2xl px-5 py-4 flex items-center justify-between active:scale-[0.99] transition-transform"
          >
            <span className="text-[17px] text-gray-400">계좌번호 입력</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-gray-400">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>

          {/* 내 계좌 — 본인 명의라 검사 없이 통과 */}
          <div className="bg-white rounded-2xl px-5 py-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[13px] font-bold text-gray-400">내 계좌</p>
              <p className="text-[12px] text-gray-300">{accounts.length}개</p>
            </div>
            {accounts.map((m) => (
              <button key={m.account}
                onClick={() => pick(m.name, m.bank, m.account)}
                className="group w-full flex items-center gap-3.5 py-3 -mx-3 px-3 rounded-xl hover:bg-gray-50 active:scale-[0.98] transition-all duration-150">
                <span className="transition-transform duration-150 group-hover:scale-105">
                  <BankLogo bank={m.bank} size={30} />
                </span>
                <span className="flex-1 text-left min-w-0">
                  <span className="block text-[15px] font-bold text-gray-900">{m.name}</span>
                  <span className="block text-[13px] text-gray-400 truncate">{m.bank} {fmtAccount(m.account)}</span>
                </span>
                <span className="text-[13px] font-semibold text-gray-400 shrink-0">{m.balance}원</span>
              </button>
            ))}
          </div>

          {/* 최근 보낸 계좌 — 고르면 금액 화면으로 */}
          <div className="bg-white rounded-2xl px-5 py-4">
            <p className="text-[13px] font-bold text-gray-400 mb-1">최근 보낸 계좌</p>
            {KNOWN_RECIPIENTS.map((r) => (
              <button key={r.name}
                onClick={() => pick(r.name, r.bank, r.account)}
                className="group w-full flex items-center gap-3.5 py-3 -mx-3 px-3 rounded-xl hover:bg-gray-50 active:scale-[0.98] transition-all duration-150">
                <span className="transition-transform duration-150 group-hover:scale-105">
                  <BankAvatar bank={r.bank} name={r.name} size={30} icon={RECIPIENT_ICONS[r.name]} />
                </span>
                <span className="flex-1 text-left min-w-0">
                  <span className="block text-[15px] font-bold text-gray-900">{r.name}</span>
                  <span className="block text-[13px] text-gray-400 truncate">{r.bank} {fmtAccount(r.account)}</span>
                </span>
              </button>
            ))}
          </div>

        </div>
      )}

      {/* ── 2단계: 계좌번호 + 은행 ── */}
      {step === "account" && (
        <div className="flex flex-col gap-5">
          <div className="bg-white rounded-2xl px-5 py-5">

            <label className="text-[12px] font-semibold text-gray-900 block mb-1">계좌번호</label>
            <input
              autoFocus
              value={account}
              onChange={(e) => setAccount(fmtAccount(e.target.value))}
              placeholder="- 없이 숫자만 입력"
              inputMode="numeric"
              className="w-full text-[20px] font-semibold tracking-wide placeholder:text-gray-300 placeholder:font-normal placeholder:tracking-normal focus:outline-none pb-2"
            />
            <div className="h-0.5 bg-[var(--ac-500)] rounded-full" />

            <button
              onClick={() => setBankOpen(!bankOpen)}
              className="w-full flex items-center justify-between pt-6 pb-2 active:scale-[0.99] transition-transform"
            >
              {bank ? (
                <span className="flex items-center gap-2.5">
                  <BankAvatar bank={bank} name={bank} size={26} label={bank.slice(0, 1)} />
                  <span className="text-[17px] font-semibold text-gray-900">{bank}</span>
                </span>
              ) : (
                <span className="text-[17px] text-gray-400">은행 선택</span>
              )}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className="w-5 h-5 text-gray-400">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            <div className="h-px bg-gray-200" />

            <p className="text-[12px] text-gray-400 mt-2.5">
              {bank ? "계좌를 확인했어요" : "계좌번호를 입력하면 은행을 찾아드릴게요"}
            </p>
          </div>

          <button
            onClick={() => setStep("amount")}
            disabled={!accountReady}
            className="w-full py-4 rounded-xl text-[16px] font-bold text-white bg-[var(--ac-500)] hover:bg-[var(--ac-600)] active:scale-[0.98] transition-all disabled:bg-gray-200 disabled:text-gray-400"
          >
            다음
          </button>

          {/* 은행 선택 바텀시트 — 아래에서 위로 */}
          {bankOpen && (
            <div className="fixed inset-0 z-50 flex flex-col justify-end">
              <button
                aria-label="닫기"
                onClick={() => setBankOpen(false)}
                className="absolute inset-0 bg-black/40"
                style={{ animation: "fade-in .2s ease-out" }}
              />
              <div
                className="relative mx-auto w-full max-w-[430px] bg-white rounded-t-3xl pb-6 max-h-[75vh] flex flex-col"
                style={{ animation: "sheet-up .28s cubic-bezier(.32,.72,0,1)" }}
              >
                <div className="flex items-center justify-between px-5 pt-5 pb-1 shrink-0">
                  <p className="text-[18px] font-bold text-gray-900">은행/증권사</p>
                  <button onClick={() => setBankOpen(false)} className="text-gray-400 active:scale-90 transition-transform">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-6 h-6">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex gap-5 px-5 border-b border-gray-100 shrink-0">
                  {(["은행", "증권사"] as const).map((t) => (
                    <button key={t} onClick={() => setBankTab(t)}
                      className={`text-[15px] font-bold pb-2.5 pt-2 border-b-2 transition-colors ${bankTab === t ? "text-gray-900 border-gray-900" : "text-gray-400 border-transparent"}`}>
                      {t}
                    </button>
                  ))}
                </div>
                <div className="overflow-y-auto px-3 pt-2 pb-2 grid grid-cols-2 gap-1">
                  {(bankTab === "은행" ? BANKS : BROKERAGES).map((b) => (
                    <button key={b} onClick={() => { setBank(b); setBankOpen(false); }}
                      className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all active:scale-[0.98] ${bank === b ? "bg-[var(--ac-50)]" : "hover:bg-gray-50"}`}>
                      <BankAvatar bank={b} name={b} size={26} label={b.slice(0, 1)} />
                      <span className="text-[15px] font-semibold text-gray-900 truncate">{shortBank(b)}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 3단계: 금액 ── */}
      {step === "amount" && (
        <div className="flex flex-col h-[calc(100dvh-188px)]">

          {/* 받는 분 — 예금주는 조회로 자동 표시, 아이콘은 은행 이름 왼쪽 */}
          <div className="flex flex-col items-center gap-1.5 pt-2 shrink-0">
            <p className="text-[17px] font-bold text-gray-900">{name || "받는 분"}</p>
            <button onClick={() => setStep("account")} className="flex items-center gap-1.5 active:scale-95 transition-transform">
              <BankAvatar bank={bank} name={bank} size={16} label={bank.slice(0, 1)} />
              <span className="text-[13px] text-gray-400 underline underline-offset-4 decoration-gray-300">{bank} {account}</span>
            </button>
          </div>

          {/* 금액 — 남는 세로 공간을 전부 차지한다 */}
          <div className="flex-1 min-h-[36px] flex items-center justify-center">
            <p className={`text-[30px] font-bold text-center ${amt ? "text-gray-900" : "text-gray-300"}`}>
              {amt ? `${amt}원` : "얼마를 보낼까요?"}
            </p>
          </div>

          {/* 출금 계좌 */}
          <button
            onClick={() => setFromIdx((i) => (i + 1) % accounts.length)}
            className="w-full bg-gray-50 rounded-xl px-4 py-3.5 flex items-center justify-between active:scale-[0.99] transition-transform"
          >
            <span className="flex items-center gap-2 min-w-0">
              <BankLogo bank={accounts[fromIdx].bank} size={18} />
              <span className="text-[14px] text-gray-500 truncate">
                {shortBank(accounts[fromIdx].bank)}({accounts[fromIdx].account.slice(-4)})
              </span>
            </span>
            <span className="flex items-center gap-1 shrink-0">
              <span className="text-[14px] font-semibold text-gray-900">{accounts[fromIdx].balance}원</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4 text-gray-400"><path d="M6 9l6 6 6-6" /></svg>
            </span>
          </button>

          {/* 빠른 금액 */}
          <div className="flex gap-1.5 mt-2 shrink-0">
            {[10000, 50000, 100000, 1000000].map((v) => (
              <button key={v} onClick={() => setAmt(fmtAmt(String(parseAmt(amt) + v)))}
                className="flex-1 py-2 rounded-lg border border-gray-200 text-[13px] font-medium text-gray-700 active:scale-95 transition-all">
                +{v / 10000}만
              </button>
            ))}
            <button onClick={() => setAmt(fmtAmt(accounts[fromIdx].balance))}
              className="flex-1 py-2 rounded-lg border border-gray-200 text-[13px] font-medium text-gray-700 active:scale-95 transition-all">
              전액
            </button>
          </div>

          {/* 실시간 위험 미리보기도 안심동행 기능 — 연결 전에는 띄우지 않는다 */}
          {exceedsDailyLimit && (
            <div className="mt-2 flex shrink-0 items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-[12px] font-black text-red-600">!</span>
              <div>
                <p className="text-[12px] font-bold text-red-700">1일 이체한도를 초과했어요</p>
                <p className="mt-0.5 text-[11px] text-red-600">오늘 남은 한도는 {remainingDailyLimit.toLocaleString()}원이에요.</p>
              </div>
            </div>
          )}

          {paired && liveRisk && (
            <div className="mt-2 flex shrink-0 items-center gap-3 rounded-2xl border border-[var(--ac-100)] bg-gradient-to-br from-white via-[var(--ac-50)] to-white px-4 py-3 shadow-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--ac-100)] bg-[var(--ac-50)] shadow-sm">
                <img src="/ansim-ai-profile.png" alt="안심동행 AI" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[var(--ac-500)]" />
                  <span className="text-[12px] font-bold text-[var(--ac-700)]">안심동행 AI</span>
                  <span className="text-[12px] font-bold text-gray-900">· {liveRisk.label}</span>
                </div>
                <p className="mt-0.5 truncate text-[12px] text-gray-500">{liveRisk.msg}</p>
              </div>
            </div>
          )}

          {/* 숫자 키패드 */}
          <div className="grid grid-cols-3 mt-2 shrink-0">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "back"].map((k) => (
              <button key={k} onClick={() => pressKey(k)}
                className="py-3 text-[23px] font-bold text-gray-900 rounded-xl active:bg-gray-100 transition-colors flex items-center justify-center">
                {k === "back"
                  ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
                  : k}
              </button>
            ))}
          </div>

          <button
            onClick={() => { if (canSubmit) setStep("confirm"); }}
            disabled={!canSubmit}
            className="w-full py-3.5 mt-2 shrink-0 rounded-xl text-[16px] font-bold text-white bg-[var(--ac-500)] hover:bg-[var(--ac-600)] active:scale-[0.98] transition-all disabled:bg-gray-200 disabled:text-gray-400"
          >
            {exceedsDailyLimit ? "이체한도 초과" : canSubmit ? `${amt}원 보내기` : "다음"}
          </button>
        </div>
      )}

      {/* ── 4단계: 마지막 확인 ── */}
      {step === "confirm" && (
        <div className="flex flex-col min-h-[calc(100dvh-188px)]">
          <div className="flex-1 flex flex-col items-center pt-6">
            <div className="w-16 h-16 rounded-full bg-white border border-gray-100 flex items-center justify-center shadow-sm">
              <BankLogo bank={bank} size={34} />
            </div>

            <p className="text-[24px] font-bold text-gray-900 text-center leading-snug mt-5">
              {name || "받는 분"}님 계좌로<br />{amt}원 보낼까요?
            </p>
            <p className="text-[14px] text-gray-400 mt-3">수수료 무료</p>

            {/* 처음 보내는 계좌 안내 — 은행 기본 기능이라 연결 여부와 무관하게 표시 */}
            {isNewRecipient && (
              <div className="w-full mt-7 bg-amber-50 rounded-xl px-4 py-3.5 flex items-center gap-2.5">
                <svg viewBox="0 0 24 24" fill="#f59e0b" className="w-5 h-5 shrink-0"><path d="M12 2L2 21h20L12 2zm1 14h-2v2h2v-2zm0-6h-2v5h2v-5z" /></svg>
                <p className="text-[14px] font-semibold text-amber-900">최근 6개월간 거래한 적 없는 계좌예요</p>
              </div>
            )}

            <div className="w-full mt-4 bg-gray-50 rounded-xl px-4 py-4 flex flex-col gap-3">
              {[
                ["보내는 계좌", `${shortBank(accounts[fromIdx].bank)} ${fmtAccount(accounts[fromIdx].account)}`],
                ["받는 계좌", `${shortBank(bank)} ${account}`],
                ["받는분 메모", name || "-"],
                ["내통장 메모", name || "-"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <span className="text-[14px] text-gray-400 shrink-0">{label}</span>
                  <span className="text-[14px] font-semibold text-gray-900 truncate">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => {
              if (parseAmt(amt) > remainingDailyLimit) {
                setStep("amount");
                return;
              }
              setStep("checking");
            }}
            className="w-full py-4 mt-4 shrink-0 rounded-xl text-[16px] font-bold text-white bg-[var(--ac-500)] hover:bg-[var(--ac-600)] active:scale-[0.98] transition-all"
          >
            보내기
          </button>
        </div>
      )}

      {/* ── 분석 중 / 등급 결과 ──
           연결 전에는 안심동행 판정이 돌지 않으므로 평범한 송금 로딩만 보여준다. */}
      {step === "checking" && (
        !paired ? (
          <div className="min-h-[calc(100dvh-260px)] flex flex-col items-center justify-center gap-6">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 rounded-full border-4 border-[var(--ac-100)]" />
              <div className="absolute inset-0 rounded-full border-4 border-[var(--ac-500)] border-t-transparent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="var(--ac-500)" className="w-8 h-8"><path d="M12 2L2 7.5v1h20v-1L12 2z" /><path d="M4.5 9h2v8h-2zM9 9h2v8H9zM13 9h2v8h-2zM17.5 9h2v8h-2z" /><path d="M2 17h20v2H2z" /></svg>
              </div>
            </div>
            <p className="text-[16px] font-bold text-gray-900">송금하고 있어요...</p>
          </div>
        ) : checkPhase === "analyzing" ? (
          <div className="rounded-[28px] border border-[var(--ac-100)] bg-gradient-to-br from-white via-[var(--ac-50)] to-white p-6 shadow-sm">
            <div className="flex flex-col items-center text-center">
              <div className="relative flex h-24 w-24 items-center justify-center">
                <div className="absolute inset-0 rounded-full border-[6px] border-[var(--ac-100)]" />
                <div className="absolute inset-0 rounded-full border-[6px] border-[var(--ac-500)] border-t-transparent animate-spin" />
                <div className="relative h-[72px] w-[72px] overflow-hidden rounded-full border border-white bg-white shadow-md">
                  <img src="/ansim-ai-profile.png" alt="안심동행 AI" className="h-full w-full object-cover" />
                </div>
              </div>

              <div className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[12px] font-bold text-[var(--ac-700)] shadow-sm">
                <span className="h-2 w-2 rounded-full bg-[var(--ac-500)]" />
                안심동행 AI
              </div>
              <p className="mt-3 text-[20px] font-extrabold text-gray-950">거래를 확인하고 있어요</p>
              <p className="mt-1 text-[13px] text-gray-500">계좌·금액·거래 패턴을 함께 보고 있어요.</p>

              <div className="mt-5 w-full rounded-2xl bg-white px-4 py-3 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] text-gray-400">받는 계좌</span>
                  <span className="truncate text-[13px] font-semibold text-gray-900">{account}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-[13px] text-gray-400">송금 금액</span>
                  <span className="text-[15px] font-extrabold text-gray-950">{amt}원</span>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              {["행동 신호 확인", "송금 위험 신호 확인", "의도 분석 준비"].map((s, i) => (
                <div
                  key={s}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors ${
                    analyzeStep >= i ? "bg-white text-gray-900 shadow-sm" : "bg-white/60 text-gray-300"
                  }`}
                >
                  {analyzeStep > i ? (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M20 6L9 17l-5-5" /></svg>
                    </div>
                  ) : analyzeStep === i ? (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--ac-100)]">
                      <div className="h-2.5 w-2.5 rounded-full bg-[var(--ac-500)] animate-pulse" />
                    </div>
                  ) : (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100">
                      <div className="h-2.5 w-2.5 rounded-full bg-gray-300" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={`text-[14px] font-bold ${analyzeStep >= i ? "text-gray-900" : "text-gray-300"}`}>{s}</p>
                    <p className={`mt-0.5 text-[12px] ${analyzeStep >= i ? "text-gray-500" : "text-gray-300"}`}>
                      {i === 0 ? "이체 전 앱 행동을 확인" : i === 1 ? "새 계좌·고액 등 빠른 신호 확인" : "필요하면 이전 거래와 대화를 함께 분석"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : riskResult ? (
          <RiskGradeCard
            result={riskResult}
            freezeSecsLeft={freezeSecsLeft}
            onSkipFreeze={() => { setRiskLabels((prev) => prev.length ? prev : (riskResult?.reasons ?? [])); setStep("hold"); }}
            onProceed={() => {
              // A등급은 버튼 없이 자동 진행되므로 여기 도달하지 않는다.
              // B·C·D 등급은 전부 AI 확인 대화를 거쳐야 한다 — 한 번의 클릭으로
              // 의도 분석을 건너뛰고 송금을 완료시키는 경로는 남겨두지 않는다.
              if (riskResult.grade === "A") {
                setStep("success");
              } else {
                setMessages([{ role: "ai", text: FIRST_QUESTION }]);
                setTurnCount(0); setChatDone(false);
                setStep("ai-chat");
              }
            }}
          />
        ) : null
      )}

      {/* ── 성공 ── */}
      {step === "success" && (
        <div className="flex flex-col h-[calc(100dvh-216px)]">
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-5">
            <div className="w-16 h-16 rounded-full bg-[var(--ac-500)] flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8"><path d="M20 6L9 17l-5-5" /></svg>
            </div>

            <p className="text-[22px] font-bold text-gray-900 text-center leading-snug">
              {name || "수취인"}님 계좌로<br />{amt}원 보냈어요.
            </p>

            <button onClick={reset}
              className="px-6 py-2.5 rounded-xl text-[14px] font-semibold text-gray-700 bg-white border border-gray-200 hover:border-gray-300 active:scale-95 transition-all">
              추가이체
            </button>
          </div>

          {/* 영수증 — 실제 은행처럼 완료 화면 하단에 그대로 펼쳐둔다 */}
          <div className="shrink-0 bg-white rounded-2xl px-5 py-4">
            <p className="text-[17px] font-bold text-gray-900">{name || "수취인"}</p>
            <p className="text-[13px] text-gray-400 mt-0.5">{bank} {account}</p>

            <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col gap-2 text-[13px]">
              {[["보낸금액", `${amt}원`], ["수수료", "무료"], ["보낸시간", time]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <span className="text-gray-400 shrink-0">{k}</span>
                  <span className="font-semibold text-gray-900 truncate">{v}</span>
                </div>
              ))}
            </div>

            <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col gap-2 text-[13px]">
              {[
                ["출금계좌", `${shortBank(accounts[fromIdx].bank)} ${fmtAccount(accounts[fromIdx].account)}`],
                ["출금 후 잔액", `${Math.max(parseAmt(accounts[fromIdx].balance) - parseAmt(amt), 0).toLocaleString()}원`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <span className="text-gray-400 shrink-0">{k}</span>
                  <span className="font-semibold text-gray-900 truncate">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <button onClick={goHome}
            className="w-full py-4 mt-3 shrink-0 rounded-xl text-[16px] font-bold text-white bg-[var(--ac-500)] hover:bg-[var(--ac-600)] active:scale-[0.98] transition-all">
            확인
          </button>
        </div>
      )}

      {/* ── DB 경고 ── */}
      {step === "db-warning" && (
        <div className="flex flex-col gap-3">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" fill="#ef4444" className="w-5 h-5"><path d="M12 2L2 21h20L12 2zm0 3.5L19.5 19h-15L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z" /></svg>
              </div>
              <div>
                <p className="text-[15px] font-bold text-red-700">신고된 계좌입니다</p>
                <p className="text-[12px] text-red-400">더치트 DB 피해 신고 {thecheatHit?.reportCount ?? 7}건 확인됨</p>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 flex flex-col gap-2 text-[13px]">
              {[
                ["수취 계좌", account],
                ["은행",     bank || "-"],
                ["신고 건수", `${thecheatHit?.reportCount ?? 7}건`],
                ["최근 신고", thecheatHit?.lastReported ?? "2026-07-31"],
                ["피해 유형", thecheatHit?.scamTypes.join(", ") ?? "보이스피싱 사기"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-gray-400">{k}</span>
                  <span className={`font-medium ${k === "신고 건수" ? "font-bold text-red-600" : "text-gray-700"}`}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5">
            <p className="text-[14px] font-bold text-gray-900 mb-3">자녀에게 알렸어요</p>
            <div className="flex items-center gap-3 bg-[var(--ac-50)] rounded-xl p-3">
              <div className="w-9 h-9 rounded-full bg-[var(--ac-100)] flex items-center justify-center text-[13px] font-bold text-gray-900">지</div>
              <div><p className="text-[13px] font-medium text-gray-900">딸 지혜님께 알림 전송됨</p><p className="text-[11px] text-gray-400">방금 전</p></div>
            </div>
          </div>
          <button onClick={goHome} className="w-full py-3.5 rounded-xl text-[15px] font-semibold text-white bg-red-500 active:scale-[0.98] transition-all">보내지 않을게요</button>
        </div>
      )}

      {/* ── AI 대화 ── */}
      {step === "ai-chat" && (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {/* 냉각이 걸린 상태면 남은 시간을 대화 위에 계속 보여준다 — 대화와 정지가 동시에 진행 중임을 알린다 */}
          {freezeSecsLeft !== null && freezeSecsLeft > 0 && (
            <div className="shrink-0 rounded-2xl border border-[var(--ac-100)] bg-gradient-to-r from-[var(--ac-50)] via-white to-[var(--ac-50)] px-4 py-3 shadow-sm flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[var(--ac-600)] shadow-sm">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <path d="M7 11V8a5 5 0 0110 0v3" />
                    <path d="M6 11h12v9H6z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-extrabold text-[var(--ac-700)]">안심동행 AI가 송금을 잠시 멈췄어요</p>
                  <p className="text-[11px] text-gray-500 truncate">남은 시간 동안 확인 대화를 이어갈 수 있어요</p>
                </div>
              </div>
              <span className="shrink-0 rounded-xl bg-white px-3 py-1.5 text-[18px] font-black text-[var(--ac-700)] font-mono tracking-[2px] leading-none shadow-sm">
                {String(Math.floor(freezeSecsLeft / 60)).padStart(2, "0")}:{String(freezeSecsLeft % 60).padStart(2, "0")}
              </span>
            </div>
          )}
          <div className="rounded-[22px] border border-[var(--ac-100)] bg-gradient-to-br from-white via-[var(--ac-50)] to-white px-4 py-4 shadow-sm flex flex-col gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[var(--ac-700)] shadow-sm">
                <span className="h-2 w-2 rounded-full bg-[var(--ac-500)]" />
                안심동행 AI 확인
              </div>
              <p className="mt-2 text-[16px] font-extrabold text-gray-950">안전을 위해 한 번 더 확인할게요</p>
              <p className="mt-1 text-[13px] leading-relaxed text-gray-600">처음 보내는 계좌에 큰 금액을 보내려고 해요.</p>
            </div>
            {riskLabels.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {riskLabels.map((l) => (
                  <span key={l} className="text-[11px] font-bold text-[var(--ac-700)] bg-white border border-[var(--ac-100)] px-2.5 py-1 rounded-full shadow-sm">
                    {l}
                  </span>
                ))}
              </div>
            )}
            {fraudTypeLabel && (
              <p className="rounded-xl bg-white px-3 py-2 text-[12px] font-bold text-[var(--ac-700)] shadow-sm">의심 유형: {fraudTypeLabel}</p>
            )}
            {fallback && (
              <p className="rounded-xl bg-white/70 px-3 py-2 text-[11px] text-gray-500">※ AI 연결이 불안정해 사전 정의 시나리오로 진행 중이에요</p>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-[24px] border border-[var(--ac-100)] bg-white p-4 flex flex-col gap-3 shadow-sm">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "ai" && <div className="mr-2 mt-0.5 h-8 w-8 shrink-0 overflow-hidden rounded-full border border-blue-100 bg-blue-50 shadow-sm"><img src="/ansim-ai-profile.png" alt="안심동행 AI" className="h-full w-full object-cover" /></div>}
                <div className={`${msg.role === "ai" ? "max-w-[88%]" : "max-w-[78%]"} min-w-0`}>
                  <div className={`${msg.role === "ai" ? "w-full bg-[var(--ac-50)] text-gray-800 rounded-tl-sm" : "bg-[var(--ac-500)] text-white rounded-tr-sm"} rounded-2xl px-4 py-3 text-[14px] whitespace-pre-wrap leading-[1.75] break-keep`}>
                    {msg.role === "ai"
                      ? msg.display === "structured" || (msg.display === undefined && isStructuredAiMessage(msg.text))
                        ? <ReadableAiMessage text={msg.text} />
                        : <p>{msg.text}</p>
                      : msg.text}
                    {msg.role === "ai" && speechSupported && (
                      <button
                        type="button"
                        onClick={() => toggleAiSpeech(
                          msg.text,
                          i,
                          msg.display ?? (isStructuredAiMessage(msg.text) ? "structured" : "plain"),
                        )}
                        aria-label={speakingMessageIndex === i ? "답변 음성 재생 중지" : "이 답변을 음성으로 듣기"}
                        aria-pressed={speakingMessageIndex === i}
                        className="ml-auto mt-1.5 flex h-7 items-center gap-1 rounded-lg border border-[var(--ac-200)] bg-white/80 px-2 text-[10px] font-extrabold leading-none text-[var(--ac-700)] transition active:scale-[0.97]"
                      >
                        {speakingMessageIndex === i ? (
                          <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3" aria-hidden="true"><path d="M7 6.5A1.5 1.5 0 018.5 5h7A1.5 1.5 0 0117 6.5v11a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 017 17.5v-11z" /></svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden="true"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 010 7" /><path d="M18 6a8.5 8.5 0 010 12" /></svg>
                        )}
                        {speakingMessageIndex === i ? "듣기 중지" : "답변 듣기"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="mr-2 h-8 w-8 shrink-0 overflow-hidden rounded-full border border-blue-100 bg-blue-50 shadow-sm"><img src="/ansim-ai-profile.png" alt="안심동행 AI가 답변 중" className="h-full w-full object-cover" /></div>
                <div className="bg-[var(--ac-50)] px-4 py-3 rounded-2xl rounded-tl-sm flex gap-1 items-center">
                  {[0, 150, 300].map((d) => <div key={d} className="w-2 h-2 rounded-full bg-[var(--ac-300)] animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                </div>
              </div>
            )}
            {/* 공식 사례·영상 — 금감원 자료. 사기 유형이 확정됐을 때만 붙는다 */}
            {chatDone && analysisHold && official?.status === "curated" && (
              <div className="ml-10 mr-2 rounded-2xl border border-gray-100 bg-white p-4">
                <div className="flex items-center gap-1.5">
                  <svg viewBox="0 0 24 24" fill="var(--ac-500)" className="h-[18px] w-[18px]"><path d="M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zm6 3.5v7l6-3.5-6-3.5z" /></svg>
                  <p className="text-[14px] font-bold text-gray-900">실제로 있었던 일</p>
                  <span className="ml-auto text-[11px] text-gray-400">금융감독원</span>
                </div>

                {official.items.map((item) =>
                  item.kind === "video" ? (
                    <div key={item.videoId}>
                      <p className="mt-2 text-[12px] leading-relaxed text-gray-500">{item.headline}</p>

                      {playingVideo === item.videoId ? (
                        // 앱을 벗어나지 않고 그 자리에서 본다
                        <div className="mt-3 overflow-hidden rounded-xl bg-black" style={{ aspectRatio: "16 / 9" }}>
                          <iframe
                            src={`${item.embedUrl}&autoplay=1`}
                            title={item.title}
                            allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
                            allowFullScreen
                            className="h-full w-full border-0"
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => setPlayingVideo(item.videoId)}
                          className="group mt-3 w-full text-left active:scale-[0.99] transition-transform"
                        >
                          {/* 유튜브 카드처럼 16:9 전체 폭 — 고령 사용자가 보기 쉽게 크게 */}
                          <span className="relative block w-full overflow-hidden rounded-xl bg-gray-900" style={{ aspectRatio: "16 / 9" }}>
                            <img
                              src={item.thumbnailUrl}
                              alt=""
                              className="h-full w-full object-cover"
                              onError={(e) => { e.currentTarget.style.display = "none"; }}
                            />
                            <span className="absolute inset-0 bg-black/15" />
                            <span className="absolute inset-0 flex items-center justify-center">
                              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/65 shadow-lg transition-transform duration-200 group-hover:scale-110">
                                <svg viewBox="0 0 24 24" fill="white" className="ml-1 h-7 w-7"><path d="M8 5v14l11-7z" /></svg>
                              </span>
                            </span>
                            <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-bold text-white">
                              {item.duration}
                            </span>
                          </span>
                          <span className="mt-2.5 block text-[15px] font-bold leading-snug text-gray-900">{item.title}</span>
                          <span className="mt-1 block text-[12px] text-gray-400">{item.source} 공식 영상</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <a
                      key={item.url} href={item.url} target="_blank" rel="noreferrer"
                      className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3 text-[14px] font-semibold text-gray-700 active:scale-[0.99] transition-transform"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-gray-400"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /></svg>
                      {item.title}
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="ml-auto h-4 w-4 text-gray-300"><path d="M9 6l6 6-6 6" /></svg>
                    </a>
                  )
                )}
              </div>
            )}
            {resumeNotice && (
              <p className="mx-2 rounded-xl bg-gray-50 px-4 py-2.5 text-center text-[12px] leading-relaxed text-gray-500">
                저장해 두신 상담이에요. 궁금한 점이나 달라진 상황을 말씀해 주세요.
              </p>
            )}
            <div ref={chatEndRef} />
          </div>
          {chatDone && analysisHold && (
            <div className="shrink-0 rounded-2xl border border-[var(--ac-100)] bg-[var(--ac-50)] px-4 py-3">
              <p className="text-[13px] font-bold text-[var(--ac-700)]">송금만 잠시 멈췄어요</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-gray-600">상담은 끝나지 않았어요. 아래에서 계속 물어보실 수 있어요.</p>
            </div>
          )}
          <div className="mt-auto flex shrink-0 gap-2 bg-[#fafbfe] pt-1">
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSend()} placeholder="더 궁금한 내용을 입력하세요..." disabled={isTyping}
              className="h-14 flex-1 rounded-2xl border border-gray-200 px-5 text-[15px] focus:border-[var(--ac-400)] focus:outline-none transition-colors disabled:bg-gray-50" />
            <button onClick={handleSend} disabled={!input.trim() || isTyping} className="h-14 w-14 shrink-0 rounded-2xl bg-[var(--ac-500)] flex items-center justify-center active:scale-95 transition-transform disabled:bg-gray-200">
              <svg viewBox="0 0 24 24" fill="white" className="w-5.5 h-5.5"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z" /></svg>
            </button>
          </div>
          {chatDone && (
            analysisHold && protectionPolicy.allowFamilyDecision ? (
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  onClick={requestFamilyConfirmation}
                  className="h-14 w-full rounded-2xl bg-[var(--ac-500)] text-[15px] font-bold text-white active:scale-[0.98] transition-transform"
                >
                  가족에게 함께 확인 요청하기
                </button>
                <button
                  onClick={pauseIntentChat}
                  className="py-1.5 text-[13px] font-semibold text-gray-500 underline decoration-gray-300 underline-offset-4 active:scale-[0.98] transition-transform"
                >
                  상담을 저장하고 나중에 이어보기
                </button>
              </div>
            ) : (
              /* 냉각이 남아 있으면 대화가 끝나도 보낼 수 없다 — 정지는 대화 결과로 우회되지 않는다 */
              <div className="flex shrink-0 flex-col gap-2">
                <button
                  onClick={() => setStep("success")}
                  disabled={freezeSecsLeft !== null && freezeSecsLeft > 0}
                  className="h-14 w-full rounded-2xl bg-[var(--ac-500)] text-[15px] font-bold text-white active:scale-[0.98] transition-transform disabled:bg-gray-200 disabled:text-gray-400"
                >
                  {freezeSecsLeft !== null && freezeSecsLeft > 0
                    ? `송금 정지 해제까지 ${String(Math.floor(freezeSecsLeft / 60)).padStart(2, "0")}:${String(freezeSecsLeft % 60).padStart(2, "0")}`
                    : analysisHold ? "위험을 확인했고 송금 계속하기" : "송금 계속하기"}
                </button>
                {analysisHold && (
                  <button onClick={goHome} className="py-2 text-[13px] font-semibold text-gray-500 underline decoration-gray-300 underline-offset-4">
                    송금 취소하고 홈으로 돌아가기
                  </button>
                )}
              </div>
            )
          )}
        </div>
      )}

      {/* ── 홀드 ── */}
      {step === "hold" && (
        <div className="flex flex-col gap-4">
          {/* ── 헤더 ── */}
          <div className="bg-gradient-to-br from-[var(--ac-hero-from)] via-[var(--ac-hero-via)] to-[var(--ac-hero-to)] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 48 48" fill="white" fillOpacity="0.9" className="w-7 h-7"><circle cx="14" cy="12" r="4.5" /><path d="M14 17c-4 0-7 3-7 7v6h14v-6c0-4-3-7-7-7z" /><circle cx="34" cy="12" r="4.5" /><path d="M34 17c-4 0-7 3-7 7v6h14v-6c0-4-3-7-7-7z" /></svg>
              </div>
              <div>
                <p className="text-white font-bold text-[17px]">{paired ? "따님에게 확인을 요청했어요" : "5분 동안 송금이 멈췄어요"}</p>
                <p className="text-white/80 text-[12px] mt-0.5">{paired ? "차단이 아니에요 — 함께 확인하는 거예요" : "그 사이에 아래 내용을 꼭 확인해 주세요"}</p>
              </div>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-white/70 text-[11px] font-medium tracking-wide">위험도 판정</span>
                <span className="bg-red-400 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">HIGH</span>
              </div>
              <p className="text-white text-[13px] font-medium">{riskLabels.length ? riskLabels.join(" · ") + " 감지" : "위험 신호 감지"}</p>
              <p className="text-white/70 text-[12px]">{amt}원 · {account}{bank ? ` · ${bank}` : ""}</p>
            </div>
          </div>

          {/* ── 1. 지금 할 수 있는 것 ── */}
          <div className="bg-white rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-100 text-[11px] font-black text-red-600">!</span>
              <p className="text-[15px] font-bold text-gray-900">지금 할 수 있는 것</p>
            </div>
            <div className="flex flex-col gap-2.5">
              <button className="flex items-center gap-3.5 w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-left active:scale-[0.98] transition-all">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5"><path d="M16.5 3.5a1.5 1.5 0 011.5 1.5v14a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 016 19V5a1.5 1.5 0 011.5-1.5h9z" stroke="#dc2626" strokeWidth="1.8" /><path d="M4 4l16 16" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" /></svg>
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-red-700">통화 중이라면 지금 끊으세요</p>
                  <p className="text-[11px] text-red-400 mt-0.5">수사기관은 전화로 송금을 요구하지 않아요</p>
                </div>
              </button>
              {paired && (
                <a href="tel:010-0000-0000" className="flex items-center gap-3.5 w-full rounded-xl border border-[var(--ac-200)] bg-[var(--ac-50)] px-4 py-3.5 text-left active:scale-[0.98] transition-all">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--ac-100)]">
                    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.86 19.86 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.86 19.86 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="var(--ac-600)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-gray-900">자녀에게 직접 전화하기</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">확인 알림을 보냈지만 직접 통화가 가장 빨라요</p>
                  </div>
                </a>
              )}
              <button onClick={goHome} className="flex items-center gap-3.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-left active:scale-[0.98] transition-all">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100">
                  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5"><path d="M18 6L6 18M6 6l12 12" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" /></svg>
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-gray-900">송금 직접 취소하기</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">언제든 부모님이 직접 취소할 수 있어요</p>
                </div>
              </button>
            </div>
          </div>

          {/* ── 2. 직접 확인해 보세요 ── */}
          <div className="bg-white rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-100">
                <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4"><path d="M9 11l3 3L22 4" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
              <p className="text-[15px] font-bold text-gray-900">직접 확인해 보세요</p>
            </div>
            <div className="flex flex-col gap-0">
              {[
                <>그 번호가 맞는지, <span className="font-semibold text-gray-900">114 또는 공식 대표번호</span>로 직접 걸어 확인하셨나요?</>,
                <>받는 분 이름이 <span className="font-semibold text-gray-900">내가 아는 사람</span>이 맞나요?</>,
                <>"<span className="font-semibold text-gray-900">급하니까 빨리</span>" 라는 말을 들으셨다면, 한 번 더 생각해 보세요.</>,
              ].map((text, i) => (
                <div key={i} className={`flex items-start gap-3 py-3 ${i < 2 ? "border-b border-gray-100" : ""}`}>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-50 text-[12px] font-bold text-amber-600 mt-0.5">{i + 1}</span>
                  <span className="text-[13px] text-gray-600 leading-relaxed">{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── 3. 이런 사례가 있었어요 ── */}
          {official?.status === "curated" && official.items.length > 0 && (
            <div className="bg-white rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--ac-100)]">
                  <svg viewBox="0 0 24 24" fill="var(--ac-600)" className="w-4 h-4"><path d="M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zm6 3.5v7l6-3.5-6-3.5z" /></svg>
                </span>
                <p className="text-[15px] font-bold text-gray-900">이런 사례가 있었어요</p>
                <span className="ml-auto rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-medium text-gray-500">금융감독원</span>
              </div>
              {official.items.map((item) =>
                item.kind === "video" ? (
                  <div key={item.videoId}>
                    <p className="text-[13px] leading-relaxed text-gray-500 mb-3">{item.headline}</p>
                    {playingVideo === item.videoId ? (
                      <div className="overflow-hidden rounded-xl bg-black" style={{ aspectRatio: "16 / 9" }}>
                        <iframe src={`${item.embedUrl}&autoplay=1`} title={item.title} allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen className="h-full w-full border-0" />
                      </div>
                    ) : (
                      <button onClick={() => setPlayingVideo(item.videoId)} className="group w-full text-left active:scale-[0.99] transition-transform">
                        <span className="relative block w-full overflow-hidden rounded-xl bg-gray-900" style={{ aspectRatio: "16 / 9" }}>
                          <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                          <span className="absolute inset-0 bg-black/15" />
                          <span className="absolute inset-0 flex items-center justify-center">
                            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/65 shadow-lg transition-transform duration-200 group-hover:scale-110">
                              <svg viewBox="0 0 24 24" fill="white" className="ml-1 h-7 w-7"><path d="M8 5v14l11-7z" /></svg>
                            </span>
                          </span>
                          <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-bold text-white">{item.duration}</span>
                        </span>
                        <span className="mt-2 block text-[13px] font-semibold text-gray-900">{item.title}</span>
                        <span className="mt-0.5 block text-[11px] text-gray-400">{item.source} · {item.duration}</span>
                      </button>
                    )}
                  </div>
                ) : item.kind === "case_board" ? (
                  <div key={item.url} className="mt-3 flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ac-100)]">
                      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="var(--ac-600)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-gray-900 truncate">{item.title}</span>
                      <span className="block text-[11px] text-gray-400 mt-0.5">{item.source}</span>
                    </span>
                    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 shrink-0"><path d="M9 18l6-6-6-6" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                ) : null
              )}
            </div>
          )}

          {/* ── 하단 버튼 ── */}
          <button onClick={goHome} className="w-full py-3.5 rounded-xl text-[14px] font-semibold text-gray-500 border border-gray-200 bg-white active:scale-[0.98] transition-all">홈으로 돌아가기</button>
        </div>
      )}

      {/* ── 골든타임 ── */}
      {step === "already-sent" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-gradient-to-br from-red-700 via-red-600 to-orange-500 p-5 text-white shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold">Lv.3 긴급 대응 에이전트</span>
              <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-black text-red-600">DEMO</span>
            </div>
            <p className="mt-3 text-[21px] font-bold">피해 대응을 바로 시작할게요</p>
            <p className="mt-1 text-[12px] leading-relaxed text-red-100">거래정보를 확인하고 한 번 승인하면 지급정지 요청과 피해구제 서류를 자동으로 준비해요.</p>
          </div>

          {emergencyStage !== "submitted" && (
            <div className="rounded-2xl bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[14px] font-bold text-gray-900">1. 피해 거래 확인</p>
                  <p className="mt-1 text-[11px] text-gray-400">현재 송금 화면에서 자동으로 불러온 정보예요.</p>
                </div>
                <span className="rounded-full bg-green-50 px-2 py-1 text-[9px] font-bold text-green-700">자동 입력</span>
              </div>
              <div className="mt-4 rounded-xl bg-gray-50 p-4 text-[12px]">
                {[
                  ["수취 계좌", account || "확인 필요"],
                  ["수취 은행", bank || "확인 필요"],
                  ["송금 금액", amt ? `${amt}원` : "확인 필요"],
                  ["송금 시각", time],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-4 border-b border-gray-100 py-2 last:border-0">
                    <span className="text-gray-400">{label}</span>
                    <span className={`truncate text-right font-semibold ${label === "송금 금액" ? "text-red-600" : "text-gray-800"}`}>{value}</span>
                  </div>
                ))}
              </div>
              {(!account || !bank || !amt) && (
                <p className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-700">확인되지 않은 정보는 실제 접수 전에 부모님이 직접 입력해야 해요.</p>
              )}
            </div>
          )}

          {emergencyStage === "review" && (
            <div className="rounded-2xl bg-white p-5">
              <p className="text-[14px] font-bold text-gray-900">2. 긴급 접수로 진행되는 일</p>
              <p className="mt-1 text-[11px] leading-relaxed text-gray-400">본인인증 후 아래 절차를 한 번에 시작해요.</p>
              <div className="mt-4 flex flex-col gap-3">
                {[
                  ["지급정지 요청", "한결은행에 접수하고 수취 금융회사로 전달을 요청해요."],
                  ["경찰 신고 초안 작성", "송금정보·위험 신호·대화 근거를 사건 순서로 정리해요."],
                  ["피해구제 신청서 작성", "은행 제출용 신청정보와 필요한 증거 목록을 정리해요."],
                ].map(([title, description], index) => (
                  <div key={title} className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3.5 py-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-600 text-[11px] font-bold text-white">{index + 1}</span>
                    <span>
                      <span className="block text-[12px] font-bold text-gray-900">{title}</span>
                      <span className="mt-0.5 block text-[11px] leading-relaxed text-gray-500">{description}</span>
                    </span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setEmergencyConsent((value) => !value)}
                className={`mt-4 flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all ${emergencyConsent ? "border-[var(--ac-300)] bg-[var(--ac-50)]" : "border-gray-200 bg-white"}`}
              >
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${emergencyConsent ? "border-[var(--ac-500)] bg-[var(--ac-500)]" : "border-gray-300"}`}>
                  {emergencyConsent && <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5"><path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </span>
                <span>
                  <span className="block text-[12px] font-bold text-gray-900">피해 대응 신청 내용을 확인했습니다</span>
                  <span className="mt-1 block text-[10px] leading-relaxed text-gray-500">거래정보와 위험 분석 결과가 은행 접수 및 신고서 작성에 사용되는 것에 동의해요.</span>
                </span>
              </button>

              <button
                type="button"
                disabled={!emergencyConsent}
                onClick={() => setEmergencyAuthOpen(true)}
                className="mt-3 h-14 w-full rounded-xl bg-red-600 text-[15px] font-bold text-white transition-all active:scale-[0.98] disabled:bg-gray-200 disabled:text-gray-400"
              >
                본인인증 후 긴급 접수하기
              </button>
              <p className="mt-2 text-center text-[10px] leading-relaxed text-gray-400">데모에서는 본인인증과 기관 접수를 가상으로 처리하며 실제 신청은 이루어지지 않아요.</p>
            </div>
          )}

          {emergencyStage === "submitting" && (
            <div className="rounded-2xl bg-white p-6 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
                <span className="h-7 w-7 animate-spin rounded-full border-3 border-red-100 border-t-red-600" />
              </span>
              <p className="mt-4 text-[16px] font-bold text-gray-900">긴급 대응을 접수하고 있어요</p>
              <p className="mt-1 text-[12px] text-gray-500">지급정지 요청과 신고·피해구제 자료를 함께 준비 중이에요.</p>
              <div className="mt-5 flex flex-col gap-2 text-left">
                {["피해 거래 확인 완료", "지급정지 요청서 생성 중", "신고·피해구제 자료 정리 중"].map((label, index) => (
                  <div key={label} className="flex items-center gap-2.5 rounded-xl bg-gray-50 px-3 py-2.5">
                    <span className={`h-2 w-2 rounded-full ${index === 0 ? "bg-green-500" : "animate-pulse bg-red-400"}`} />
                    <span className="text-[11px] font-medium text-gray-600">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {emergencyStage === "submitted" && completedEmergencyFollowups === 5 && (
            <div className="flex flex-col gap-3">
              <div className="rounded-[24px] bg-gradient-to-br from-green-600 to-emerald-500 p-5 text-white shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-2xl font-bold">✓</span>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-black text-red-600">MVP DEMO</span>
                </div>
                <h2 className="mt-5 text-[21px] font-bold">긴급 대응 접수가 완료됐어요</h2>
                <p className="mt-2 text-[12px] leading-relaxed text-green-50">필요한 초기 대응을 모두 마쳤어요. 이제 은행과 관계기관의 확인 결과를 기다려 주세요.</p>
                <div className="mt-4 rounded-xl bg-white/15 px-4 py-3 text-[11px]">
                  <div className="flex justify-between gap-3"><span className="text-green-50">가상 접수번호</span><span className="font-bold">{emergencyReceipt}</span></div>
                </div>
              </div>

              <div className="rounded-2xl bg-white p-5">
                <div className="flex items-center justify-between">
                  <p className="text-[15px] font-bold text-gray-900">현재 처리 상태</p>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[9px] font-bold text-amber-700">기관 확인 중</span>
                </div>
                <div className="mt-4 flex flex-col gap-3">
                  {[
                    ["은행 지급정지 요청", "접수 완료", true],
                    ["112 피해 신고", "접수 완료", true],
                    ["피해구제 신청서", "전자서명 완료", true],
                    ["수취 금융회사 확인", "기관 확인 대기", false],
                    ["피해구제 심사", "심사 대기", false],
                  ].map(([title, status, done]) => (
                    <div key={String(title)} className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-3">
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${done ? "bg-green-500 text-white" : "bg-amber-100 text-amber-700"}`}>{done ? "✓" : "•"}</span>
                      <span className="min-w-0 flex-1 text-[11px] font-semibold text-gray-800">{title}</span>
                      <span className={`text-[9px] font-bold ${done ? "text-green-600" : "text-amber-600"}`}>{status}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-5">
                <p className="text-[15px] font-bold text-gray-900">이제 이렇게 해주세요</p>
                <div className="mt-3 flex flex-col gap-2.5">
                  {["은행이나 경찰의 공식 연락에 응답해 주세요.", "추가 자료를 요청받으면 보관한 증거를 제출해 주세요.", "추가 송금이나 원격제어 앱 설치 요구에는 응하지 마세요."].map((text, index) => (
                    <div key={text} className="flex gap-2.5 text-[11px] leading-relaxed text-gray-600"><span className="font-bold text-blue-600">{index + 1}</span><p>{text}</p></div>
                  ))}
                </div>
              </div>

              {showEmergencyStatus && (
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <p className="text-[12px] font-bold text-blue-900">처리 현황 안내</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-blue-700">접수 완료는 피해금 반환 완료를 의미하지 않아요. 은행 앱 알림과 경찰의 공식 연락을 확인하고, 접수번호를 안전하게 보관해 주세요.</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setShowEmergencyStatus((value) => !value)} className="h-12 rounded-xl border border-blue-200 bg-blue-50 text-[12px] font-bold text-blue-700">처리 현황 확인</button>
                <button type="button" disabled={emergencyReceiptSaved} onClick={saveEmergencyReceipt} className="h-12 rounded-xl border border-gray-200 bg-white text-[12px] font-bold text-gray-700 disabled:border-green-200 disabled:bg-green-50 disabled:text-green-700">{emergencyReceiptSaved ? "안심동행 AI에 저장 완료" : "접수 내역 저장"}</button>
              </div>
            </div>
          )}

          {emergencyStage === "submitted" && completedEmergencyFollowups < 5 && (
            <div className="flex flex-col gap-3">
              <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500">
                    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5"><path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[16px] font-bold text-green-800">긴급 대응 가상 접수 완료</p>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-black text-red-600">DEMO</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-green-700">실서비스에서는 기관의 접수 응답을 받은 뒤에만 접수 완료로 표시해요.</p>
                  </div>
                </div>
                <div className="mt-4 rounded-xl bg-white/80 px-4 py-3">
                  <div className="flex justify-between gap-3 text-[11px]"><span className="text-gray-400">가상 접수번호</span><span className="font-bold text-gray-800">{emergencyReceipt}</span></div>
                  <div className="mt-2 flex justify-between gap-3 text-[11px]"><span className="text-gray-400">접수 시각</span><span className="font-semibold text-gray-700">{nowTime()}</span></div>
                </div>
              </div>

              <div className="rounded-2xl bg-white p-5">
                <p className="text-[14px] font-bold text-gray-900">처리 현황</p>
                <div className="mt-4 flex flex-col">
                  {[
                    ["한결은행 지급정지 요청", "가상 접수 완료", "complete"],
                    ["수취 금융회사 전달", "기관 확인 대기", "pending"],
                    ["경찰 신고서 초안", "작성 완료", "complete"],
                    ["피해구제 신청서", reliefSigned ? "가상 서명 완료" : "전자서명 대기", reliefSigned ? "complete" : "pending"],
                  ].map(([title, status, state], index, items) => (
                    <div key={title} className="relative flex gap-3 pb-4 last:pb-0">
                      {index < items.length - 1 && <span className="absolute left-[11px] top-6 h-[calc(100%-12px)] w-px bg-gray-200" />}
                      <span className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${state === "complete" ? "bg-green-500" : "bg-amber-100"}`}>
                        {state === "complete" ? <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5"><path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="3" strokeLinecap="round" /></svg> : <span className="h-2 w-2 rounded-full bg-amber-500" />}
                      </span>
                      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                        <span className="text-[12px] font-semibold text-gray-800">{title}</span>
                        <span className={`shrink-0 text-[10px] font-bold ${state === "complete" ? "text-green-600" : "text-amber-600"}`}>{status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-bold text-gray-900">다음 절차를 진행해 주세요</p>
                    <p className="mt-1 text-[11px] text-gray-400">접수에 이어 필요한 절차를 순서대로 확인해 주세요.</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${completedEmergencyFollowups === 5 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{completedEmergencyFollowups}/5 완료</span>
                </div>

                <div className="mt-4 flex flex-col gap-3">
                  <div className={`rounded-xl border p-4 ${reliefSigned ? "border-green-200 bg-green-50" : "border-red-100 bg-red-50/60"}`}>
                    <div className="flex items-start gap-3">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${reliefSigned ? "bg-green-500" : "bg-red-600"}`}>{reliefSigned ? "✓" : "1"}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[13px] font-bold text-gray-900">피해구제 신청서 전자서명</p>
                          {!reliefSigned && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold text-red-600">지금 필요</span>}
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-gray-500">자동 작성된 피해 내용과 송금 정보를 확인하고 부모님이 직접 서명해요.</p>
                        <button
                          type="button"
                          disabled={reliefSigned}
                          onClick={() => setReliefDocumentOpen(true)}
                          className="mt-3 rounded-lg bg-red-600 px-3 py-2 text-[11px] font-bold text-white transition-all active:scale-[0.98] disabled:bg-green-500"
                        >
                          {reliefSigned ? "가상 전자서명 완료" : "신청서 PDF 확인하고 전자서명"}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className={`rounded-xl border p-4 ${policeReportDone ? "border-green-200 bg-green-50" : "border-gray-100 bg-gray-50"}`}>
                    <div className="flex items-start gap-3">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${policeReportDone ? "bg-green-500" : "bg-gray-800"}`}>{policeReportDone ? "✓" : "2"}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[13px] font-bold text-gray-900">112에 피해 신고 접수</p>
                          {policeReportDone && <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold text-green-700">완료</span>}
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-gray-500">에이전트가 작성한 신고 초안을 먼저 확인하고, 틀린 내용은 직접 수정해 주세요.</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" onClick={() => setPoliceDraftOpen(true)} className="rounded-lg bg-gray-900 px-3 py-2 text-[11px] font-bold text-white active:scale-[0.98] transition-transform">
                            {policeDraftConfirmed ? "신고 초안 다시 보기" : "신고 초안 확인하기"}
                          </button>
                          {policeDraftConfirmed && !policeReportDone && (
                            <a href="tel:112" className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-bold text-white active:scale-[0.98] transition-transform">
                              <svg viewBox="0 0 24 24" fill="white" className="h-3.5 w-3.5"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" /></svg>
                              112 전화 연결
                            </a>
                          )}
                          {policeDraftConfirmed && (
                            <button type="button" disabled={policeReportDone} onClick={() => setPoliceReportDone(true)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[11px] font-bold text-gray-700 active:scale-[0.98] disabled:border-green-200 disabled:text-green-700">
                              {policeReportDone ? "신고 접수 완료" : "접수번호 받았어요"}
                            </button>
                          )}
                        </div>
                        {policeDraftConfirmed && !policeReportDone && <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-[10px] font-medium leading-relaxed text-blue-700">초안 확인이 끝났어요. 112 연결 후 상담원의 응답을 기다리고, 신고 내용을 전달해 주세요.</p>}
                      </div>
                    </div>
                  </div>

                  <div className={`rounded-xl border p-4 ${evidenceSaved ? "border-green-200 bg-green-50" : "border-gray-100 bg-gray-50"}`}>
                    <div className="flex items-start gap-3">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${evidenceSaved ? "bg-green-500" : "bg-gray-400"}`}>{evidenceSaved ? "✓" : "3"}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold text-gray-900">증거를 삭제하지 말고 보관</p>
                        <p className="mt-1 text-[11px] leading-relaxed text-gray-500">문자·메신저·통화기록·상대 번호·송금확인증을 삭제하지 마세요. 에이전트가 현재 자료 목록을 묶어둘게요.</p>
                        <button
                          type="button"
                          disabled={evidenceSaved}
                          onClick={() => setEvidenceSaved(true)}
                          className="mt-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[11px] font-bold text-gray-700 transition-all active:scale-[0.98] disabled:border-green-200 disabled:text-green-700"
                        >
                          {evidenceSaved ? "증거 목록 보관 완료" : "증거 목록 보관하기"}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className={`flex items-start gap-3 rounded-xl border p-4 ${safetyConfirmed ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-black text-white ${safetyConfirmed ? "bg-green-500" : "bg-amber-500"}`}>{safetyConfirmed ? "✓" : "4"}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={`text-[13px] font-bold ${safetyConfirmed ? "text-gray-900" : "text-amber-900"}`}>추가 송금·앱 설치·원격제어 금지</p>
                        {safetyConfirmed && <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold text-green-700">확인 완료</span>}
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-amber-800">피해금 반환이나 수사 협조를 이유로 돈을 더 보내거나 앱을 설치하라는 연락에는 응하지 마세요.</p>
                      <button type="button" disabled={safetyConfirmed} onClick={() => setSafetyConfirmed(true)} className="mt-3 rounded-lg border border-amber-200 bg-white px-3 py-2 text-[11px] font-bold text-amber-800 active:scale-[0.98] disabled:border-green-200 disabled:text-green-700">
                        {safetyConfirmed ? "주의사항 확인 완료" : "주의사항 확인했어요"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className={`mt-4 flex items-start gap-3 rounded-xl border px-4 py-3 ${bankFollowupConfirmed ? "border-green-200 bg-green-50" : "border-blue-100 bg-blue-50"}`}>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${bankFollowupConfirmed ? "bg-green-500" : "bg-blue-600"}`}>{bankFollowupConfirmed ? "✓" : "5"}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={`text-[11px] font-bold ${bankFollowupConfirmed ? "text-gray-900" : "text-blue-800"}`}>은행 연락을 확인해 주세요</p>
                      {bankFollowupConfirmed && <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold text-green-700">확인 완료</span>}
                    </div>
                    <p className={`mt-1 text-[10px] leading-relaxed ${bankFollowupConfirmed ? "text-gray-600" : "text-blue-700"}`}>지급정지 처리 결과나 추가 서류 요청은 은행 앱 알림 또는 공식 대표번호로 확인하세요. 접수만으로 피해금 회수가 보장되지는 않아요.</p>
                    <button type="button" disabled={bankFollowupConfirmed} onClick={() => setBankFollowupConfirmed(true)} className="mt-3 rounded-lg border border-blue-200 bg-white px-3 py-2 text-[11px] font-bold text-blue-700 active:scale-[0.98] disabled:border-green-200 disabled:text-green-700">
                      {bankFollowupConfirmed ? "은행 연락 확인 완료" : "은행 연락 확인했어요"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[12px] font-bold text-gray-800">자동 접수가 어렵다면</p>
                <p className="mt-0.5 text-[10px] text-gray-400">직접 전화해 즉시 도움을 요청할 수 있어요.</p>
              </div>
              <div className="flex gap-1.5">
                <a href="tel:112" className="rounded-lg border border-gray-200 px-2.5 py-2 text-[11px] font-bold text-gray-700">112</a>
                <a href="tel:1332" className="rounded-lg border border-gray-200 px-2.5 py-2 text-[11px] font-bold text-gray-700">1332</a>
                <a href={`tel:${BANK_SUPPORT_PHONE}`} className="rounded-lg bg-[var(--ac-500)] px-2.5 py-2 text-[11px] font-bold text-white">은행</a>
              </div>
            </div>
          </div>

          <button onClick={goHome} className="w-full rounded-xl border border-gray-200 bg-white py-3 text-[14px] font-medium text-gray-500 active:scale-[0.98] transition-all">홈으로</button>

          {policeDraftOpen && (
            <div className="fixed inset-y-0 left-1/2 z-[114] flex w-full max-w-[430px] -translate-x-1/2 items-end bg-black/45">
              <button type="button" aria-label="신고 초안 닫기" onClick={() => setPoliceDraftOpen(false)} className="absolute inset-0" />
              <div className="relative w-full rounded-t-[28px] bg-white px-5 pb-8 pt-4 shadow-2xl" style={{ animation: "sheet-up .24s cubic-bezier(.2,.8,.2,1)" }}>
                <div className="mx-auto h-1 w-10 rounded-full bg-gray-200" />
                <div className="mt-5 flex items-center justify-between">
                  <div>
                    <h3 className="text-[18px] font-bold text-gray-950">112 피해 신고 초안</h3>
                    <p className="mt-1 text-[11px] text-gray-500">사실과 다른 내용이 있으면 직접 수정해 주세요.</p>
                  </div>
                  <span className="rounded-full bg-red-50 px-2 py-1 text-[9px] font-bold text-red-600">DEMO</span>
                </div>
                <div className="mt-4 rounded-2xl bg-gray-50 p-4">
                  <label htmlFor="police-draft" className="text-[11px] font-bold text-gray-700">신고 내용</label>
                  <textarea
                    id="police-draft"
                    value={policeDraft}
                    onChange={(event) => setPoliceDraft(event.target.value)}
                    rows={8}
                    className="mt-2 w-full resize-none rounded-xl border border-gray-200 bg-white p-3 text-[12px] leading-relaxed text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <p className="mt-3 text-[10px] leading-relaxed text-amber-700">확인 완료는 실제 112 신고 접수가 아닙니다. 다음 단계에서 112 상담원에게 내용을 전달해야 해요.</p>
                <div className="mt-5 grid grid-cols-[0.8fr_1.2fr] gap-2">
                  <button type="button" onClick={() => setPoliceDraftOpen(false)} className="h-12 rounded-xl border border-gray-200 text-[13px] font-bold text-gray-700">나중에</button>
                  <button type="button" disabled={!policeDraft.trim()} onClick={() => { setPoliceDraftConfirmed(true); setPoliceDraftOpen(false); }} className="h-12 rounded-xl bg-blue-600 text-[13px] font-bold text-white disabled:bg-gray-300">수정 내용 확인 완료</button>
                </div>
              </div>
            </div>
          )}

          {reliefDocumentOpen && (
            <div className="fixed inset-y-0 left-1/2 z-[115] flex w-full max-w-[430px] -translate-x-1/2 flex-col overflow-hidden bg-[#eef1f6] shadow-2xl">
              <div className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm">
                <button type="button" onClick={() => setReliefDocumentOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100">
                  <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <div className="text-center">
                  <p className="text-[15px] font-bold text-gray-900">피해구제신청서 PDF</p>
                  <p className="text-[9px] text-gray-400">공식 별지 제1호 서식 항목 기준 · 자동 작성본</p>
                </div>
                <button type="button" onClick={printReliefDocument} className="rounded-lg border border-gray-200 px-2.5 py-2 text-[10px] font-bold text-gray-600">PDF 저장</button>
              </div>

              <div className="flex flex-1 items-center justify-center overflow-y-auto overflow-x-hidden px-3 py-4">
                <div
                  className="relative mx-auto overflow-hidden rounded-sm bg-white shadow-lg"
                  style={{ width: 680 * reliefPdfScale, height: 962 * reliefPdfScale }}
                >
                  <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${reliefPdfScale})` }}>
                  <div ref={reliefDocumentRef} className="relief-pdf-page relative box-border h-[962px] w-[680px] overflow-hidden bg-white p-10 text-gray-950">
                    <div className="absolute right-8 top-7 rounded border-2 border-red-500 px-3 py-1 text-[9px] font-black text-red-500">MVP 자동 작성본</div>
                    <p className="pdf-note max-w-[470px] text-[10px] text-gray-500">■ 전기통신금융사기 피해 방지 및 피해금 환급에 관한 특별법 시행령 [별지 제1호서식]</p>
                    <h1 className="mt-5 text-center text-[24px] font-black tracking-[0.12em]">피해구제신청서</h1>
                    <p className="pdf-note mt-2 text-[10px] text-gray-500">※ 실제 제출 전 자동 입력된 내용과 첨부서류를 반드시 확인해 주세요.</p>

                    <table className="mt-3 w-full border-collapse text-[10px] [&_td]:p-1.5 [&_th]:p-1.5">
                      <tbody>
                        <tr><th className="w-24 border border-gray-800 bg-gray-100 p-2">접수번호</th><td className="border border-gray-800 p-2 text-gray-400">은행 기재란</td><th className="w-24 border border-gray-800 bg-gray-100 p-2">접수일자</th><td className="border border-gray-800 p-2 text-gray-400">은행 기재란</td></tr>
                      </tbody>
                    </table>

                    <p className="pdf-section-title mt-3 text-[11px] font-bold">1. 피해자 정보</p>
                    <table className="mt-1 w-full border-collapse text-[10px] [&_td]:p-1.5 [&_th]:p-1.5">
                      <tbody>
                        <tr><th className="w-24 border border-gray-800 bg-gray-100 p-2">성명</th><td className="border border-gray-800 p-2 font-semibold">김영순</td><th className="w-24 border border-gray-800 bg-gray-100 p-2">생년월일</th><td className="border border-gray-800 p-2">1958.03.12</td></tr>
                        <tr><th className="border border-gray-800 bg-gray-100 p-2">주소</th><td colSpan={3} className="border border-gray-800 p-2">서울특별시 중구 한결로 12 (데모 정보)</td></tr>
                        <tr><th className="border border-gray-800 bg-gray-100 p-2">휴대전화</th><td className="border border-gray-800 p-2">010-****-1024</td><th className="border border-gray-800 bg-gray-100 p-2">전자우편</th><td className="border border-gray-800 p-2">y***@example.com</td></tr>
                      </tbody>
                    </table>

                    <p className="pdf-section-title mt-3 text-[11px] font-bold">2. 피해자 계좌의 송금·이체 내역</p>
                    <table className="mt-1 w-full border-collapse text-[10px] [&_td]:p-1.5 [&_th]:p-1.5">
                      <tbody>
                        <tr><th className="w-24 border border-gray-800 bg-gray-100 p-2">금융회사</th><td className="border border-gray-800 p-2">한결은행</td><th className="w-24 border border-gray-800 bg-gray-100 p-2">계좌번호</th><td className="border border-gray-800 p-2">{accounts[fromIdx]?.account ?? "확인 필요"}</td></tr>
                        <tr><th className="border border-gray-800 bg-gray-100 p-2">명의인</th><td className="border border-gray-800 p-2">김영순</td><th className="border border-gray-800 bg-gray-100 p-2">송금 일시</th><td className="border border-gray-800 p-2">{new Date().toLocaleDateString("ko-KR")} {time}</td></tr>
                        <tr><th className="border border-gray-800 bg-gray-100 p-2">송금 금액</th><td colSpan={3} className="border border-gray-800 p-2 font-bold text-red-700">{amt ? `${amt}원` : "확인 필요"}</td></tr>
                      </tbody>
                    </table>

                    <p className="pdf-section-title mt-3 text-[11px] font-bold">3. 사기이용계좌 입금 내역</p>
                    <table className="mt-1 w-full border-collapse text-[10px] [&_td]:p-1.5 [&_th]:p-1.5">
                      <tbody>
                        <tr><th className="w-24 border border-gray-800 bg-gray-100 p-2">금융회사</th><td className="border border-gray-800 p-2">{bank || "확인 필요"}</td><th className="w-24 border border-gray-800 bg-gray-100 p-2">계좌번호</th><td className="border border-gray-800 p-2">{account || "확인 필요"}</td></tr>
                        <tr><th className="border border-gray-800 bg-gray-100 p-2">명의인</th><td className="border border-gray-800 p-2">{name || "확인 필요"}</td><th className="border border-gray-800 bg-gray-100 p-2">입금 일시</th><td className="border border-gray-800 p-2">{new Date().toLocaleDateString("ko-KR")} {time}</td></tr>
                      </tbody>
                    </table>

                    <p className="pdf-section-title mt-3 text-[11px] font-bold">4. 피해환급금 입금계좌</p>
                    <table className="mt-1 w-full border-collapse text-[10px] [&_td]:p-1.5 [&_th]:p-1.5">
                      <tbody>
                        <tr><th className="w-24 border border-gray-800 bg-gray-100 p-2">금융회사</th><td className="border border-gray-800 p-2">한결은행</td><th className="w-24 border border-gray-800 bg-gray-100 p-2">계좌번호</th><td className="border border-gray-800 p-2">{accounts[fromIdx]?.account ?? "확인 필요"}</td></tr>
                        <tr><th className="border border-gray-800 bg-gray-100 p-2">명의인</th><td colSpan={3} className="border border-gray-800 p-2">김영순</td></tr>
                      </tbody>
                    </table>

                    <p className="pdf-section-title mt-3 text-[11px] font-bold">5. 피해구제 신청 사유</p>
                    <div className="mt-1 min-h-16 border border-gray-800 p-2.5 text-[10px] leading-relaxed">
                      {fraudTypeLabel ? `${fraudTypeLabel} 의심 거래로, ` : "전기통신금융사기 의심 거래로, "}
                      상대방의 요구에 따라 위 계좌로 {amt || "확인되지 않은 금액"}원을 송금했습니다. AI 송금 의도 분석에서 {riskLabels.length ? riskLabels.join(", ") : "위험 신호"}가 확인되어 지급정지와 피해구제를 신청합니다.
                    </div>
                    <p className="mt-2 text-[9px] leading-relaxed text-red-700">※ 거짓으로 피해구제를 신청하는 경우 관련 법령에 따른 처벌 또는 손해배상 책임이 발생할 수 있습니다.</p>

                    <p className="mt-3 text-center text-[10px] leading-relaxed">위와 같이 전기통신금융사기 피해구제를 신청합니다.</p>
                    <p className="mt-2 text-center text-[10px]">{new Date().getFullYear()}년 {new Date().getMonth() + 1}월 {new Date().getDate()}일</p>
                    <div className="mt-3 flex items-end justify-end gap-4 pr-8">
                      <span className="text-[11px]">신청인 김영순</span>
                      {reliefSigned ? <span className="signature-mark border-b-2 border-blue-600 px-4 pb-1 text-[20px] font-bold italic text-blue-700">김영순</span> : <span className="rounded border border-dashed border-gray-400 px-5 py-3 text-[10px] text-gray-400">전자서명 전</span>}
                    </div>
                    <p className="mt-3 text-right text-[11px] font-bold">한결은행 귀하</p>
                    <div className="mt-3 border border-gray-800 p-2.5 text-[9px] leading-relaxed"><b>첨부서류</b> · 피해자 신분증 사본 1부 · 금융회사가 요청하는 경우 수사기관 피해신고확인서 등 관련 자료</div>
                  </div>
                  </div>
                </div>
              </div>

              <div className="shrink-0 border-t border-gray-200 bg-white px-4 pb-5 pt-3 shadow-[0_-6px_20px_rgba(0,0,0,0.06)]">
                {!reliefSigned ? (
                  <button type="button" onClick={() => setReliefSigned(true)} className="h-14 w-full rounded-xl bg-blue-600 text-[15px] font-bold text-white active:scale-[0.98] transition-transform">김영순으로 전자서명</button>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={printReliefDocument} className="h-13 rounded-xl border border-blue-200 bg-blue-50 text-[13px] font-bold text-blue-700">서명본 PDF 저장</button>
                    <button
                      type="button"
                      onClick={() => {
                        setReliefDocumentOpen(false);
                        setReliefSignatureNotice(true);
                      }}
                      className="h-13 rounded-xl bg-blue-600 text-[13px] font-bold text-white"
                    >
                      서명 완료
                    </button>
                  </div>
                )}
                <p className="mt-2 text-center text-[9px] text-gray-400">MVP 데모 문서이며 실제 금융회사 제출 전 본인정보와 첨부서류 확인이 필요해요.</p>
              </div>
            </div>
          )}

          {reliefSignatureNotice && (
            <div className="fixed inset-y-0 left-1/2 z-[120] flex w-full max-w-[430px] -translate-x-1/2 items-center justify-center bg-black/45 px-5">
              <div className="w-full rounded-[24px] bg-white p-6 shadow-2xl" style={{ animation: "sheet-up .24s cubic-bezier(.2,.8,.2,1)" }}>
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-2xl text-green-600">✓</div>
                <div className="mt-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <h3 className="text-[19px] font-bold text-gray-950">전자서명이 완료됐어요</h3>
                    <span className="rounded-full bg-red-50 px-2 py-1 text-[9px] font-bold text-red-600">DEMO</span>
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-gray-500">서명된 피해구제 신청서가 긴급 대응 접수에 반영됐어요.</p>
                </div>
                <div className="mt-5 rounded-2xl bg-gray-50 px-4 py-3 text-[12px]">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">피해구제 신청서</span>
                    <span className="font-bold text-green-600">가상 서명 완료</span>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => { setReliefSignatureNotice(false); setReliefDocumentOpen(true); }} className="h-12 rounded-xl border border-gray-200 text-[13px] font-bold text-gray-700">서명본 다시 보기</button>
                  <button type="button" onClick={() => setReliefSignatureNotice(false)} className="h-12 rounded-xl bg-blue-600 text-[13px] font-bold text-white">처리 현황 확인</button>
                </div>
              </div>
            </div>
          )}

          {emergencyAuthOpen && (
            <div className="fixed inset-0 z-[110] flex items-end justify-center">
              <button
                type="button"
                aria-label="본인인증 닫기"
                disabled={emergencyAuthVerifying}
                onClick={() => setEmergencyAuthOpen(false)}
                className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
                style={{ animation: "fade-in .18s ease-out" }}
              />
              <div
                className="relative w-full max-w-[430px] rounded-t-[28px] bg-white px-5 pb-8 pt-4 shadow-2xl"
                style={{ animation: "sheet-up .24s cubic-bezier(.2,.8,.2,1)" }}
              >
                <div className="mx-auto h-1 w-10 rounded-full bg-gray-200" />
                <div className="mt-5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50">
                      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5"><path d="M3 10h18M5 10v8m4-8v8m6-8v8m4-8v8M2 20h20M12 3l9 5H3l9-5z" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </span>
                    <div>
                      <p className="text-[11px] font-semibold text-blue-600">한결은행 보안인증</p>
                      <p className="text-[16px] font-bold text-gray-900">긴급 접수 본인확인</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-red-50 px-2.5 py-1 text-[9px] font-black text-red-600">긴급</span>
                </div>

                <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-gray-400">신청 업무</span>
                    <span className="font-bold text-gray-800">지급정지·피해구제 긴급 접수</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[12px]">
                    <span className="text-gray-400">신청자</span>
                    <span className="font-semibold text-gray-700">김영순</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[12px]">
                    <span className="text-gray-400">송금 금액</span>
                    <span className="font-bold text-red-600">{amt ? `${amt}원` : "확인 필요"}</span>
                  </div>
                </div>

                <div className="mt-6 text-center">
                  <span className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full transition-all duration-300 ${emergencyAuthVerifying ? "bg-green-50 ring-8 ring-green-50/60" : "bg-blue-50"}`}>
                    {emergencyAuthVerifying ? (
                      <span className="h-9 w-9 animate-spin rounded-full border-4 border-green-100 border-t-green-500" />
                    ) : (
                      <svg viewBox="0 0 48 48" fill="none" className="h-11 w-11"><path d="M15 7h-3a5 5 0 00-5 5v3M33 7h3a5 5 0 015 5v3M15 41h-3a5 5 0 01-5-5v-3M33 41h3a5 5 0 005-5v-3" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" /><path d="M17 22v-3a7 7 0 0114 0v3M14 22h20v15H14V22z" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /><circle cx="24" cy="29" r="2" fill="#2563eb" /></svg>
                    )}
                  </span>
                  <p className="mt-4 text-[15px] font-bold text-gray-900">{emergencyAuthVerifying ? "본인인증 중이에요" : "생체인증으로 빠르게 확인하세요"}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-gray-400">{emergencyAuthVerifying ? "인증이 완료되면 긴급 접수가 자동으로 시작돼요." : "기기에 등록된 지문 또는 얼굴 인증을 사용해요."}</p>
                </div>

                <button
                  type="button"
                  disabled={emergencyAuthVerifying}
                  onClick={verifyEmergencyIdentity}
                  className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-[15px] font-bold text-white transition-all active:scale-[0.98] disabled:bg-blue-400"
                >
                  {emergencyAuthVerifying ? (
                    <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> 인증 확인 중</>
                  ) : (
                    <><svg viewBox="0 0 24 24" fill="none" className="h-5 w-5"><path d="M8 11V8a4 4 0 018 0v3M6 11h12v10H6V11z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg> 생체인증으로 확인</>
                  )}
                </button>
                {!emergencyAuthVerifying && (
                  <button type="button" onClick={() => setEmergencyAuthOpen(false)} className="mt-2 w-full py-2 text-[13px] font-semibold text-gray-400">취소</button>
                )}
                <p className="mt-2 text-center text-[9px] leading-relaxed text-gray-300">MVP 데모 인증으로 실제 생체정보를 수집하거나 저장하지 않아요.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
