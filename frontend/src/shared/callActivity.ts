// 통화 버튼을 누른 시각을 저장해 "최근 10분 내 통화 기록이 있는지"를 판단한다.
// 화면에 카운트를 보여줄 필요는 없으므로 타임스탬프 하나만 저장해두고, 확인하는
// 시점에 현재 시각과의 차이를 계산한다 — 10분이 지나면 자동으로 "없음"이 되고,
// 통화 버튼을 다시 누르면 그 순간부터 다시 10분을 센다.

const LAST_CALL_KEY = "ansimLastCallAt";
const RECENT_WINDOW_MS = 10 * 60 * 1000;

export function markCallStarted() {
  localStorage.setItem(LAST_CALL_KEY, String(Date.now()));
}

export function hasRecentCall(): boolean {
  const raw = localStorage.getItem(LAST_CALL_KEY);
  if (!raw) return false;
  const at = Number(raw);
  return Number.isFinite(at) && Date.now() - at < RECENT_WINDOW_MS;
}
