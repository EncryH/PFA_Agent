// Development-only fixtures with synthetic balances and controlled responses.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import Transfer from "../src/screens/Transfer";
import Verify from "../src/screens/Verify";
import LockScreen from "../src/screens/LockScreen";
import { MY_ACCOUNTS } from "../src/shared/data";
import "../src/index.css";

const pending: Array<(response: Response) => void> = [];
const originalFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith("/api/counterparty/phone") || url.startsWith("/api/fsc/verify")) {
    return new Promise<Response>((resolve) => pending.push(resolve));
  }
  return originalFetch(input, init);
};
const accounts = MY_ACCOUNTS.map((account, index) => ({ ...account, balance: ((index + 1) * 1000).toLocaleString("ko-KR") }));

function Fixture() {
  const [screen, setScreen] = useState("menu");
  const [transfers, setTransfers] = useState<number[]>([]);
  const [unlockCount, setUnlockCount] = useState(0);
  return <main className="mx-auto max-w-[430px] bg-white p-4">
    <p className="mb-3 text-sm">합성 예외 테스트 · 실제 금융 거래 없음</p>
    <nav className="mb-4 flex flex-wrap gap-3">
      <button onClick={() => setScreen("transfer")}>송금 테스트</button>
      <button onClick={() => setScreen("verify")}>검증 테스트</button>
      <button onClick={() => setScreen("lock")}>잠금 테스트</button>
      <button onClick={() => pending.shift()?.(Response.json({ result: { status: "safe", label: "이전 번호 확인 결과", detail: "지연된 합성 응답" }, items: [] }))}>대기 응답 완료</button>
      <button onClick={() => pending.shift()?.(new Response("unavailable", { status: 503 }))}>대기 응답 실패</button>
    </nav>
    <p role="status">송금 처리 {transfers.length}회 · 합계 {transfers.reduce((sum, value) => sum + value, 0)}원 · 잠금 해제 {unlockCount}회</p>
    {screen === "transfer" && <Transfer accounts={accounts} dailyLimit={5000} onExit={() => setScreen("menu")} onSuccess={(_, amount) => setTransfers((previous) => [...previous, amount])} />}
    {screen === "verify" && <Verify onBack={() => setScreen("menu")} />}
    {screen === "lock" && <LockScreen onUnlock={() => { setUnlockCount((previous) => previous + 1); setScreen("menu"); }} />}
  </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
