// 백엔드 /api/intent 호출.
// 판정 로직은 전부 backend/ 에 있다 — 여기서는 결과를 받아 화면에 넘기기만 한다.

export type ChatMessage = {
  role: "ai" | "user";
  text: string;
  display?: "plain" | "structured";
};

export type TransferContext = {
  userId?: "demo-parent-01" | "demo-parent-02" | "demo-parent-03";
  sourceAccount?: string;
  occurredAt?: string;
  amount: number;
  recipientName: string;
  account: string;
  bank: string;
  isFirstTransfer?: boolean;
  patternRiskScore?: number;
  reportedAccount?: boolean;
  callInProgress?: boolean;
  // 사전 분석에서 이미 D등급(강제 최고 위험 포함)으로 확정된 상담인지 — 참이면
  // 대화 내용과 무관하게 서버가 최종 판정을 안전 쪽으로 내리지 않는다.
  forcedHold?: boolean;
};

export type ConversationState = {
  resumed: boolean;
  analysisDone: boolean;
  analysisHold: boolean;
  fraudTypeLabel?: string;
  riskLabels?: string[];
};

/** 사기 유형별로 미리 큐레이션한 공식 자료 — 금감원 사례·영상 */
export type OfficialContentItem =
  | {
      kind: "video";
      headline: string;
      title: string;
      duration: string;
      source: string;
      videoId: string;
      thumbnailUrl: string;
      embedUrl: string;
      watchUrl: string;
    }
  | { kind: "case_board"; title: string; source: string; url: string };

export type OfficialContent = {
  status: "curated" | "not_applicable" | "not_configured";
  curated_at?: string;
  fraud_type?: string;
  items: OfficialContentItem[];
};

export type Verdict = {
  /** 다음에 보여줄 AI 메시지 */
  message: string;
  /** 송금을 보류하고 가족 확인 옵션을 제안할지 — 규칙이 서버에서 판정 */
  hold: boolean;
  /** 대화 종료 여부 */
  done: boolean;
  risk: { score: number; labels: string[]; level: "LOW" | "MEDIUM" | "HIGH" };
  intent: { purpose: string; requester: string; channel: string };
  analysis?: {
    version: string;
    suspected_fraud_type: { code: string; label: string; source: string };
    impersonation: string;
    interaction_direction: string;
    attack_stage: string;
    requested_actions: string[];
    answer_contradictions: string[];
    missing_information: string[];
    evidence_phrases: string[];
    retrieval: {
      method: string;
      fraud_evidence: { id: string; score: number; source_dataset: string; review_status: string }[];
      normal_evidence: { id: string; score: number; source_dataset: string; review_status: string }[];
      transaction_pattern?: {
        status: "ready" | "disabled" | "unavailable";
        method: string;
        user_id: string;
        lookback_months: number;
        average_transfer_amount: number;
        maximum_transfer_amount: number;
        recipient_transfer_count: number;
        recipient_known: boolean;
        typical_transfer_hour: number;
        risk_score: number;
        risk_reasons: string[];
      };
      knowledge_graph?: {
        status: "ready" | "disabled" | "unavailable";
        method: string;
        paths: {
          fraud_type_code: string;
          fraud_type_label: string;
          score: number;
          matched_signal_codes: string[];
          steps: { order: number; label: string; stage: string; stageLabel: string }[];
        }[];
      };
    };
    official_content: OfficialContent;
  };
  /** LLM 장애로 사전 정의 시나리오를 쓴 경우 */
  fallback: boolean;
  middleware?: {
    route: "STATIC" | "GENERAL" | "RISK" | "BLOCK";
    confidence: number;
    reason: string;
    securityFlags: string[];
    bypassedHeavyPipeline: boolean;
    sessionLocked: boolean;
  };
};

export const FIRST_QUESTION = "처음 보내는 계좌예요. 어떤 돈인지 여쭤봐도 될까요? 😊";

/** 네트워크 자체가 끊긴 경우의 최후 폴백 — 데모가 멈추지 않게 한다. */
const OFFLINE: Verdict = {
  message: "지금은 확인이 어려워요. 안전을 위해 따님에게 함께 확인받아볼게요.",
  hold: true,
  done: true,
  risk: { score: 50, labels: ["확인 회피"], level: "HIGH" },
  intent: { purpose: "", requester: "", channel: "" },
  fallback: true,
};

export async function takeTurn(
  transfer: TransferContext,
  messages: ChatMessage[],
  turn: number,
  conversationState?: ConversationState,
): Promise<Verdict> {
  try {
    const res = await fetch("/api/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transfer, messages, turn, conversationState }),
    });
    if (!res.ok) throw new Error(`/api/intent ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("[guardian] 백엔드 연결 실패:", err);
    return OFFLINE;
  }
}
