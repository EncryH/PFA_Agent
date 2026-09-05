// 혜택 탭의 포인트 잔액 — 역할(부모·자녀)별로 따로 쌓이고, 실제로 사용(환급)하면
// 그만큼 줄어든다. 계좌 잔액에 반영하는 건 화면(App.tsx/ChildApp.tsx)이 각자 담당하고,
// 여기서는 "포인트가 실제로 줄어드는가"만 책임진다.

import { useEffect, useState } from "react";

const pointsKey = (role: string) => `ansimPoints_${role}`;
const spentKey = (role: string) => `ansimPointsSpent_${role}`;

const DEFAULT_POINTS = 12_340;

function readNumber(key: string, fallback: number): number {
  const raw = localStorage.getItem(key);
  if (raw == null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function usePoints(role: string) {
  const [points, setPoints] = useState(() => readNumber(pointsKey(role), DEFAULT_POINTS));
  const [spent, setSpent] = useState(() => readNumber(spentKey(role), 0));

  useEffect(() => {
    setPoints(readNumber(pointsKey(role), DEFAULT_POINTS));
    setSpent(readNumber(spentKey(role), 0));
  }, [role]);

  // 심사·데모 리셋으로 localStorage 값이 지워지면, 같은 문서 안에서는 storage
  // 이벤트가 안 뜨므로 별도 이벤트로 다시 읽어온다.
  useEffect(() => {
    const resync = () => {
      setPoints(readNumber(pointsKey(role), DEFAULT_POINTS));
      setSpent(readNumber(spentKey(role), 0));
    };
    window.addEventListener("ansim-demo-reset", resync);
    return () => window.removeEventListener("ansim-demo-reset", resync);
  }, [role]);

  useEffect(() => { localStorage.setItem(pointsKey(role), String(points)); }, [role, points]);
  useEffect(() => { localStorage.setItem(spentKey(role), String(spent)); }, [role, spent]);

  const redeem = (amount: number) => {
    if (amount <= 0 || amount > points) return false;
    setPoints((p) => p - amount);
    setSpent((s) => s + amount);
    return true;
  };

  return { points, spent, redeem };
}
