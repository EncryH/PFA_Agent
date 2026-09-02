// 전역 송금 정지(쿨다운) — D등급 판정 시 시작된다.
// Transfer 화면 자신의 freezeSecsLeft는 화면을 벗어나면(뒤로가기·홈으로) 함께 사라지지만,
// "우회 불가"는 화면 하나가 아니라 앱 전체에 걸려야 한다. 그래서 남은 시간을 localStorage에
// 따로 적어두고, 정지 중에는 어디서 "송금" 버튼을 누르든 새 송금 화면 진입 자체를 막는다.

import { useEffect, useState } from "react";

const STORAGE_KEY = "ansimCooldownUntil";
export const COOLDOWN_EVENT = "ansim-cooldown";

export function startGlobalCooldown(seconds: number) {
  if (seconds <= 0) return;
  const endsAt = Date.now() + seconds * 1000;
  const current = Number(localStorage.getItem(STORAGE_KEY) ?? 0);
  // 이미 더 긴 정지가 걸려 있다면 짧게 덮어쓰지 않는다.
  if (endsAt <= current) return;
  localStorage.setItem(STORAGE_KEY, String(endsAt));
  window.dispatchEvent(new Event(COOLDOWN_EVENT));
}

export function getCooldownSecondsLeft(): number {
  const endsAt = Number(localStorage.getItem(STORAGE_KEY) ?? 0);
  if (!endsAt) return 0;
  return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
}

export function useGlobalCooldown(): number {
  const [secondsLeft, setSecondsLeft] = useState(() => getCooldownSecondsLeft());

  useEffect(() => {
    const sync = () => setSecondsLeft(getCooldownSecondsLeft());
    sync();
    const id = setInterval(sync, 1000);
    window.addEventListener(COOLDOWN_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      clearInterval(id);
      window.removeEventListener(COOLDOWN_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return secondsLeft;
}
