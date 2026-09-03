export type MonthlySpendingCategory = "이체" | "자동이체" | "체크카드";

export type MonthlySpendingRow = {
  id: string;
  date: string;
  time: string;
  name: string;
  category: MonthlySpendingCategory;
  amount: number;
  account: string;
};

export const MONTHLY_SPENDING_ROWS: MonthlySpendingRow[] = [
  { id: "sep-02-family", date: "09.02", time: "13:40", name: "딸 지혜", category: "이체", amount: 300_000, account: "한결은행 입출금통장" },
  { id: "sep-02-market", date: "09.02", time: "10:15", name: "시장 상회", category: "이체", amount: 350_000, account: "한결은행 입출금통장" },
  { id: "sep-01-maintenance", date: "09.01", time: "09:00", name: "아파트 관리비", category: "자동이체", amount: 184_000, account: "한결은행 입출금통장" },
  { id: "sep-01-card", date: "09.01", time: "08:42", name: "동네마트", category: "체크카드", amount: 51_000, account: "한결은행 입출금통장" },
];

export const MONTHLY_SPENDING_BREAKDOWN = (["이체", "자동이체", "체크카드"] as const).map((category) => ({
  category,
  amount: MONTHLY_SPENDING_ROWS
    .filter((row) => row.category === category)
    .reduce((sum, row) => sum + row.amount, 0),
}));

export const MONTHLY_SPENDING_TOTAL = MONTHLY_SPENDING_ROWS.reduce((sum, row) => sum + row.amount, 0);
