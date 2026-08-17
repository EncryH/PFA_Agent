import { useEffect, useState } from "react";

export type ProtectionLevel = 0 | 1 | 2 | 3;

export const PROTECTION_LEVELS = [
  { level: 0 as const, name: "알림", desc: "위험 신호가 보이면 부모님께 안내해요." },
  { level: 1 as const, name: "잠시 지연", desc: "고위험 송금을 5분 멈추고 다시 확인해요." },
  { level: 2 as const, name: "공동확인", desc: "고위험 상황을 가족에게 알리고 함께 확인해요." },
  { level: 3 as const, name: "피해대응", desc: "공동확인과 함께 지급정지·신고 절차를 안내해요." },
] as const;

const STORAGE_KEY = "ansimProtectionLevel";
export const PROTECTION_EVENT = "ansim-protection-level";

export function readProtectionLevel(): ProtectionLevel {
  const value = Number(localStorage.getItem(STORAGE_KEY) ?? 2);
  return value === 0 || value === 1 || value === 2 || value === 3 ? value : 2;
}

export function saveProtectionLevel(level: ProtectionLevel) {
  localStorage.setItem(STORAGE_KEY, String(level));
  window.dispatchEvent(new Event(PROTECTION_EVENT));
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
