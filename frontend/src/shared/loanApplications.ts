// 대출 상품 신청 내역 — 예금·적금과 달리 대출은 신청 즉시 돈이 움직이지 않고
// "심사 접수"만 된다. 접수됐다는 사실 자체를 기록해 두지 않으면 신청 화면을 닫는
// 순간 그 신청이 있었다는 증거가 어디에도 안 남으므로, 역할(부모·자녀)별로
// localStorage에 신청 목록을 남기고 화면에서 다시 조회할 수 있게 한다.

import { useEffect, useState } from "react";

export type LoanApplication = {
  id: string;
  productTitle: string;
  amount: number;
  appliedAt: number;
};

const EVENT = "ansim-loan-application";
const keyFor = (role: string) => `ansimLoanApplications_${role}`;

function read(role: string): LoanApplication[] {
  try {
    const raw = JSON.parse(localStorage.getItem(keyFor(role)) ?? "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function applyForLoan(role: string, productTitle: string, amount: number) {
  const entry: LoanApplication = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, productTitle, amount, appliedAt: Date.now() };
  localStorage.setItem(keyFor(role), JSON.stringify([entry, ...read(role)]));
  window.dispatchEvent(new Event(EVENT));
}

export function useLoanApplications(role: string): LoanApplication[] {
  const [list, setList] = useState<LoanApplication[]>(() => read(role));

  useEffect(() => {
    const sync = () => setList(read(role));
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    // 심사·데모 리셋으로 localStorage 값이 지워지면, 같은 문서 안에서는 storage
    // 이벤트가 안 뜨므로 별도 이벤트로 다시 읽어온다.
    window.addEventListener("ansim-demo-reset", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener("ansim-demo-reset", sync);
    };
  }, [role]);

  return list;
}
