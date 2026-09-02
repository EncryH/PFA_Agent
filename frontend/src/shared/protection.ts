import { useEffect, useState } from "react";

export type ProtectionLevel = 0 | 1 | 2 | 3;

export const PROTECTION_LEVELS = [
  {
    level: 0 as const,
    name: "알림",
    desc: "위험을 부모님께만 알리고, 송금 결정은 부모님이 직접 해요.",
    permissions: ["부모 위험 알림"],
    detailSteps: [
      "AI가 송금 대화와 위험 신호를 분석해 부모님 화면에 이유를 알려요.",
      "송금을 자동으로 지연하거나 자녀에게 정보를 보내지 않아요.",
      "위험 안내를 확인한 뒤 취소하거나 계속할지는 부모님이 직접 결정해요.",
    ],
    limit: "자녀는 위험 알림을 받지 않으며 승인·보류 의견을 낼 수 없어요.",
  },
  {
    level: 1 as const,
    name: "잠시 지연",
    desc: "고위험 송금을 5분 멈춘 뒤 부모님이 다시 결정해요.",
    permissions: ["부모 위험 알림", "고위험 송금 5분 지연"],
    detailSteps: [
      "AI가 고위험 송금으로 판단하면 부모님께 위험 이유를 알려요.",
      "긴급한 판단을 피할 수 있도록 송금을 5분 동안 멈춰요.",
      "5분이 지난 뒤 부모님이 위험 내용을 다시 확인하고 최종 결정해요.",
    ],
    limit: "자녀에게 송금 정보가 전달되지 않으며 자녀가 승인하거나 보류할 수 없어요.",
  },
  {
    level: 2 as const,
    name: "공동확인",
    desc: "5분 지연 후 가족에게 최소 정보만 보내 함께 확인해요.",
    permissions: ["부모 위험 알림", "고위험 송금 5분 지연", "자녀 승인·보류 의견"],
    detailSteps: [
      "AI가 고위험 송금을 알리고 5분 동안 송금을 멈춰요.",
      "부모님이 확인을 요청하면 검증된 자녀에게 금액·받는 계좌·위험 이유만 전달해요.",
      "자녀는 대화 근거를 확인한 뒤 승인 또는 보류 의견을 부모님께 보내요.",
      "자녀의 의견을 받은 뒤 최종 송금 여부는 부모님이 다시 결정해요.",
    ],
    limit: "자녀의 보류는 24시간 자동 지연이 아니며, 자녀가 부모님 대신 송금을 실행하거나 취소할 수 없어요.",
  },
  {
    level: 3 as const,
    name: "피해대응",
    desc: "공동확인에 지급정지·신고·피해구제 안내를 더해요.",
    permissions: ["부모 위험 알림", "고위험 송금 5분 지연", "자녀 승인·보류 의견", "피해대응 절차 안내"],
    detailSteps: [
      "공동확인 단계와 동일하게 5분 지연 후 자녀와 위험 송금을 함께 확인해요.",
      "이미 송금했다면 거래 금융회사에 지급정지를 요청하는 순서를 안내해요.",
      "경찰 신고와 금융감독원 피해 상담에 필요한 정보와 순서를 안내해요.",
      "대화·송금 정보 등 피해구제에 필요한 증거를 보관하도록 도와요.",
    ],
    limit: "안심동행 AI가 직접 지급정지·신고를 실행하거나 피해금 회수를 보장하지 않아요.",
  },
] as const;

export type ProtectionPolicy = {
  delaySeconds: number;
  notifyFamily: boolean;
  allowFamilyDecision: boolean;
  guideDamageResponse: boolean;
};

export type AiReviewThreshold = number;

export function getProtectionDisplayLevel(level?: ProtectionLevel | number): number {
  return (level ?? 2) + 1;
}

export const AI_REVIEW_THRESHOLD_OPTIONS = [
  { amount: 1_000_000 as const, label: "100만원", desc: "조금만 이상해도 확인" },
  { amount: 3_000_000 as const, label: "300만원", desc: "큰돈부터 확인" },
  { amount: 10_000_000 as const, label: "1,000만원", desc: "고액 송금 중심" },
  { amount: 30_000_000 as const, label: "3,000만원", desc: "매우 큰 금액만" },
] as const;

export function getProtectionPolicy(level: ProtectionLevel): ProtectionPolicy {
  return {
    delaySeconds: level >= 1 ? 300 : 0,
    notifyFamily: level >= 2,
    allowFamilyDecision: level >= 2,
    guideDamageResponse: level >= 3,
  };
}

const STORAGE_KEY = "ansimProtectionLevel";
const AI_REVIEW_THRESHOLD_KEY = "ansimAiReviewThreshold";
export const PROTECTION_EVENT = "ansim-protection-level";
export const AI_REVIEW_THRESHOLD_EVENT = "ansim-ai-review-threshold";

export function readProtectionLevel(): ProtectionLevel {
  const value = Number(localStorage.getItem(STORAGE_KEY) ?? 2);
  return value === 0 || value === 1 || value === 2 || value === 3 ? value : 2;
}

export function saveProtectionLevel(level: ProtectionLevel) {
  localStorage.setItem(STORAGE_KEY, String(level));
  window.dispatchEvent(new Event(PROTECTION_EVENT));
}

export function readAiReviewThreshold(): AiReviewThreshold {
  const value = Number(localStorage.getItem(AI_REVIEW_THRESHOLD_KEY) ?? 1_000_000);
  return Number.isFinite(value) && value >= 10_000
    ? value
    : 1_000_000;
}

export function saveAiReviewThreshold(amount: AiReviewThreshold) {
  const safeAmount = Math.max(10_000, Math.floor(Number(amount) || 1_000_000));
  localStorage.setItem(AI_REVIEW_THRESHOLD_KEY, String(safeAmount));
  window.dispatchEvent(new Event(AI_REVIEW_THRESHOLD_EVENT));
}

export function useProtectionLevel() {
  const [level, setLevel] = useState<ProtectionLevel>(readProtectionLevel);

  useEffect(() => {
    const sync = () => setLevel(readProtectionLevel());
    window.addEventListener(PROTECTION_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(PROTECTION_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return [level, saveProtectionLevel] as const;
}

export function useAiReviewThreshold() {
  const [threshold, setThreshold] = useState<AiReviewThreshold>(readAiReviewThreshold);

  useEffect(() => {
    const sync = () => setThreshold(readAiReviewThreshold());
    window.addEventListener(AI_REVIEW_THRESHOLD_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(AI_REVIEW_THRESHOLD_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return [threshold, saveAiReviewThreshold] as const;
}
