// 가족 확인 기록 — 자녀가 부모의 위험 거래를 확인하고 판단한 이력.
//
// 알림은 '지금 처리할 일'이고, 이 로그는 '지나간 판단'이다.
// 알림을 처리하면 ansimAlert 는 지워지지만 판단 이력은 남아야 한다.
//
// 실서비스에서는 통신사기피해환급법 제2조의5의 조치내역 보존(5년)이 들어갈 자리.
//
// 프라이버시 원칙: 잔액·거래내역·소비패턴은 담지 않는다.
// 위험 이벤트의 최소 정보(금액·수취계좌·판정 근거·대화)만 기록한다.

import { useEffect, useState } from "react";
import { maskAccountForFamily } from "./privacyStorage";

export type GuardianDecision = "approved" | "held" | null;

export type GuardianLogEntry = {
  schemaVersion: 1;
  /** 부모 앱이 알림을 만든 시각(_ts) 기준 — 같은 사건을 두 번 쌓지 않기 위한 키 */
  id: string;
  raisedAt: string;
  amount: number;
  account: string;
  bank: string;
  risk: string;
  signals: string[];
  fraudTypeLabel: string;
  conversation: { role: "ai" | "user"; text: string }[];
  /** 자녀가 대화 내용을 열어본 시각 — 열지 않고 판단했는지 구분한다 */
  viewedAt: string | null;
  decision: GuardianDecision;
  decidedAt: string | null;
  /** 자녀가 남긴 승인·보류 사유 */
  decisionReason?: string;
  /** 부모 앱에서 판단 결과 알림을 확인한 시각 */
  parentViewedAt?: string | null;
};

const STORAGE_KEY = "ansimGuardianLogV1";
export const GUARDIAN_LOG_EVENT = "ansim-guardian-log";
const MAX_ENTRIES = 20;

const notify = () => window.dispatchEvent(new Event(GUARDIAN_LOG_EVENT));

export function readGuardianLog(): GuardianLogEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    const entries = raw
      .filter((item): item is GuardianLogEntry => item?.schemaVersion === 1 && typeof item?.id === "string")
      .map((item) => ({ ...item, account: maskAccountForFamily(item.account, item.bank) }))
      .sort((left, right) => Date.parse(right.raisedAt) - Date.parse(left.raisedAt));
    if (JSON.stringify(entries) !== JSON.stringify(raw)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
    }
    return entries;
  } catch {
    return [];
  }
}

const write = (entries: GuardianLogEntry[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  notify();
};

/**
 * 위험 알림이 도착하면 기록을 시작한다.
 * 같은 사건(id)이 이미 있으면 덮어쓰지 않는다 — 자녀가 남긴 판단을 지우면 안 된다.
 */
export function openGuardianLogEntry(input: {
  id: string;
  raisedAt?: string;
  amount: number;
  account: string;
  bank?: string;
  risk?: string;
  signals?: string[];
  fraudTypeLabel?: string;
  conversation?: { role: "ai" | "user"; text: string }[];
}) {
  const entries = readGuardianLog();
  if (entries.some((entry) => entry.id === input.id)) return;

  const entry: GuardianLogEntry = {
    schemaVersion: 1,
    id: input.id,
    raisedAt: input.raisedAt ?? new Date().toISOString(),
    amount: input.amount,
    account: input.account,
    bank: input.bank ?? "",
    risk: input.risk ?? "HIGH",
    signals: input.signals ?? [],
    fraudTypeLabel: input.fraudTypeLabel ?? "",
    conversation: input.conversation ?? [],
    viewedAt: null,
    decision: null,
    decidedAt: null,
    decisionReason: "",
    parentViewedAt: null,
  };
  write([entry, ...entries]);
}

/** 자녀가 대화 내용을 열어봤다 — 처음 열어본 시각만 남긴다 */
export function markGuardianLogViewed(id: string) {
  const entries = readGuardianLog();
  const target = entries.find((entry) => entry.id === id);
  if (!target || target.viewedAt) return;
  write(entries.map((entry) => (entry.id === id ? { ...entry, viewedAt: new Date().toISOString() } : entry)));
}

/** 승인·보류 판단을 기록한다 */
export function recordGuardianDecision(id: string, decision: Exclude<GuardianDecision, null>, reason = "") {
  const entries = readGuardianLog();
  if (!entries.some((entry) => entry.id === id)) return;
  write(entries.map((entry) => (
    entry.id === id ? { ...entry, decision, decisionReason: reason.trim(), decidedAt: new Date().toISOString(), parentViewedAt: null } : entry
  )));
}

/** 부모가 새 승인·보류 알림을 열어본 것으로 표시한다 */
export function markGuardianDecisionsViewed() {
  const entries = readGuardianLog();
  const viewedAt = new Date().toISOString();
  if (!entries.some((entry) => entry.decision && entry.decidedAt && !entry.parentViewedAt)) return;
  write(entries.map((entry) => (
    entry.decision && entry.decidedAt && !entry.parentViewedAt ? { ...entry, parentViewedAt: viewedAt } : entry
  )));
}

export function deleteGuardianLogEntry(id: string) {
  const entries = readGuardianLog();
  write(entries.filter((entry) => entry.id !== id));
}

export function useGuardianLog() {
  const [entries, setEntries] = useState<GuardianLogEntry[]>(readGuardianLog);

  useEffect(() => {
    const sync = () => setEntries(readGuardianLog());
    window.addEventListener(GUARDIAN_LOG_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(GUARDIAN_LOG_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return entries;
}

/** "8월 17일 오후 2:07" — 기록 목록에 쓰는 표기 */
export const fmtLogTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${d.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" })}`;
};
