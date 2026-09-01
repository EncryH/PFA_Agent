import { useEffect, useState } from "react";
import familyProtectionConfigJson from "../../../shared/family-protection-policy.json";

export type ProtectionLevel = 0 | 1 | 2 | 3;

export type ProtectionPolicy = {
  readonly delaySeconds: number;
  readonly notifyFamily: boolean;
  readonly allowFamilyDecision: boolean;
  readonly guideDamageResponse: boolean;
};

type ProtectionLevelDefinition = {
  readonly level: ProtectionLevel;
  readonly code: string;
  readonly name: string;
  readonly desc: string;
  readonly permissions: readonly string[];
  readonly detailSteps: readonly string[];
  readonly limit: string;
  readonly policy: ProtectionPolicy;
};

type FamilyProtectionConfig = {
  readonly feature: { readonly key: string; readonly name: string };
  readonly levels: readonly ProtectionLevelDefinition[];
};

const familyProtectionConfig = familyProtectionConfigJson as FamilyProtectionConfig;

export const PROTECTION_LEVELS = familyProtectionConfig.levels;

export type AiReviewThreshold = number;

export const AI_REVIEW_THRESHOLD_OPTIONS = [
  { amount: 1_000_000 as const, label: "100만원", desc: "조금만 이상해도 확인" },
  { amount: 3_000_000 as const, label: "300만원", desc: "큰돈부터 확인" },
  { amount: 10_000_000 as const, label: "1,000만원", desc: "고액 송금 중심" },
  { amount: 30_000_000 as const, label: "3,000만원", desc: "매우 큰 금액만" },
] as const;

export function getProtectionPolicy(level: ProtectionLevel): ProtectionPolicy {
  return PROTECTION_LEVELS.find((item) => item.level === level)?.policy
    ?? PROTECTION_LEVELS[0].policy;
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
