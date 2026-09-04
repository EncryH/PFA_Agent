// 통화 버튼을 누른 시각을 저장해 "최근 10분 내 통화 기록이 있는지"를 판단한다.
// 화면에 카운트를 보여줄 필요는 없으므로 타임스탬프 하나만 저장해두고, 확인하는
// 시점에 현재 시각과의 차이를 계산한다 — 10분이 지나면 자동으로 "없음"이 되고,
// 통화 버튼을 다시 누르면 그 순간부터 다시 10분을 센다.
//
// 통화 대사 스크립트(shared/callScript.ts)에서 감지된 키워드("이체한도 올려라",
// "얼마 보내라")도 같은 10분 창 안에서만 유효한 것으로 취급해, 같이 저장·조회한다.

import type { ScriptFlag } from "./callScript";

const LAST_CALL_KEY = "ansimLastCallAt";
const SCRIPT_FLAGS_KEY = "ansimLastCallScriptFlags";
const SCRIPT_ID_KEY = "ansimLastCallScriptId";
const RECENT_WINDOW_MS = 10 * 60 * 1000;

export function markCallStarted() {
  localStorage.setItem(LAST_CALL_KEY, String(Date.now()));
  // 새 통화가 시작되면 이전 통화에서 감지된 키워드·시나리오는 지운다
  localStorage.removeItem(SCRIPT_FLAGS_KEY);
  localStorage.removeItem(SCRIPT_ID_KEY);
}

/** 지금 재생 중인 통화 시나리오의 id를 기록한다 — 경고 화면 문구를 시나리오별로 고르는 데 쓴다. */
export function markCallScriptId(id: string) {
  localStorage.setItem(SCRIPT_ID_KEY, id);
}

/** 최근 10분 창이 지나면 어떤 시나리오였는지도 더 이상 유효하지 않은 것으로 본다. */
export function getRecentCallScriptId(): string | null {
  if (!hasRecentCall()) return null;
  return localStorage.getItem(SCRIPT_ID_KEY);
}

export function hasRecentCall(): boolean {
  const raw = localStorage.getItem(LAST_CALL_KEY);
  if (!raw) return false;
  const at = Number(raw);
  return Number.isFinite(at) && Date.now() - at < RECENT_WINDOW_MS;
}

function readScriptFlags(): Partial<Record<ScriptFlag, boolean>> {
  try {
    const raw = localStorage.getItem(SCRIPT_FLAGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function markCallScriptFlag(flag: ScriptFlag) {
  const current = readScriptFlags();
  if (current[flag]) return;
  localStorage.setItem(SCRIPT_FLAGS_KEY, JSON.stringify({ ...current, [flag]: true }));
}

/** 최근 10분 창이 지나면 예전 통화에서 감지된 키워드는 더 이상 유효하지 않은 것으로 본다. */
export function getRecentCallScriptFlags(): Record<ScriptFlag, boolean> {
  if (!hasRecentCall()) return { limitIncreaseRequest: false, savingsCloseRequest: false, transferRequest: false };
  const flags = readScriptFlags();
  return {
    limitIncreaseRequest: !!flags.limitIncreaseRequest,
    savingsCloseRequest: !!flags.savingsCloseRequest,
    transferRequest: !!flags.transferRequest,
  };
}
