// 고객센터 문의 — 로컬에 접수하고 접수 이력을 그대로 보여준다.
// 실서비스에서는 상담원 배정·답변 큐가 들어갈 자리. 여기서는 접수 자체가
// 실제로 동작하는 것(입력 → 저장 → 목록 반영)이 핵심이라 접수 상태만 다룬다.

import { useEffect, useState } from "react";

export type Inquiry = {
  schemaVersion: 1;
  id: string;
  text: string;
  createdAt: string;
  status: "접수완료";
};

const STORAGE_KEY = "ansimInquiriesV1";
export const INQUIRY_EVENT = "ansim-inquiry";
const MAX_ENTRIES = 20;

const notify = () => window.dispatchEvent(new Event(INQUIRY_EVENT));

export function readInquiries(): Inquiry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((item): item is Inquiry => item?.schemaVersion === 1 && typeof item?.id === "string")
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  } catch {
    return [];
  }
}

/** 문의를 접수한다 — 빈 문의는 저장하지 않는다. */
export function submitInquiry(text: string): Inquiry | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const entry: Inquiry = {
    schemaVersion: 1,
    id: `inquiry-${Date.now()}`,
    text: trimmed,
    createdAt: new Date().toISOString(),
    status: "접수완료",
  };
  const entries = [entry, ...readInquiries()].slice(0, MAX_ENTRIES);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  notify();
  return entry;
}

export function useInquiries() {
  const [entries, setEntries] = useState<Inquiry[]>(readInquiries);

  useEffect(() => {
    const sync = () => setEntries(readInquiries());
    window.addEventListener(INQUIRY_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(INQUIRY_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return entries;
}
