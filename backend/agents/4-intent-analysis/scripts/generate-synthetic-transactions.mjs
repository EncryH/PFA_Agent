import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const TRANSACTIONS_OUTPUT_PATH = resolve(
  SCRIPT_DIR,
  "../datasets/text2sql/synthetic-transactions.csv",
);
const USERS_OUTPUT_PATH = resolve(
  SCRIPT_DIR,
  "../datasets/text2sql/synthetic-users.csv",
);

const PROFILES = [
  {
    user_id: "demo-parent-01",
    display_name: "김영순",
    profile_type: "근로·연금 생활형",
    age_band: "60대",
    account_id: "1101234567",
    account_name: "한결은행 입출금통장",
    bank_name: "한결은행",
    target_end_balance: 21_470_000,
  },
  {
    user_id: "demo-parent-02",
    display_name: "박성호",
    profile_type: "자영업 거래형",
    age_band: "60대",
    account_id: "1102234568",
    account_name: "한결은행 사업생활통장",
    bank_name: "한결은행",
    target_end_balance: 14_820_000,
  },
  {
    user_id: "demo-parent-03",
    display_name: "이정자",
    profile_type: "연금·의료 생활형",
    age_band: "70대",
    account_id: "1103234569",
    account_name: "한결은행 연금생활통장",
    bank_name: "한결은행",
    target_end_balance: 8_640_000,
  },
];

let randomState = 20260831;
function random() {
  randomState = (randomState * 1664525 + 1013904223) >>> 0;
  return randomState / 2 ** 32;
}

function pick(values) {
  return values[Math.floor(random() * values.length)];
}

function integer(min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function timestamp(year, month, day, hour, minute) {
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00+09:00`;
}

function hashRef(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `acct_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function csvValue(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const transactions = [];
let activeProfile = PROFILES[0];

function addTransaction({
  occurredAt,
  direction,
  amount,
  counterpartyName,
  counterpartyBank,
  category,
  transactionType,
  channel,
  memo,
  recurring = false,
}) {
  transactions.push({
    user_id: activeProfile.user_id,
    account_id: activeProfile.account_id,
    occurred_at: occurredAt,
    direction,
    amount,
    counterparty_name: counterpartyName,
    counterparty_bank: counterpartyBank,
    counterparty_account_hash: hashRef(`${counterpartyBank}:${counterpartyName}`),
    category,
    transaction_type: transactionType,
    channel,
    memo,
    is_recurring: recurring,
  });
}

const months = [
  [2025, 9], [2025, 10], [2025, 11], [2025, 12],
  [2026, 1], [2026, 2], [2026, 3], [2026, 4],
  [2026, 5], [2026, 6], [2026, 7], [2026, 8],
];

for (const [year, month] of months) {
  const lastDay = daysInMonth(year, month);

  // 정기 소득: 국민연금과 시니어센터 급여가 매월 비슷한 날짜·금액으로 들어온다.
  addTransaction({
    occurredAt: timestamp(year, month, 3, 8, 30),
    direction: "IN",
    amount: 1_012_000,
    counterpartyName: "국민연금공단",
    counterpartyBank: "한결은행",
    category: "INCOME",
    transactionType: "PENSION",
    channel: "ACCOUNT_CREDIT",
    memo: "국민연금",
    recurring: true,
  });
  addTransaction({
    occurredAt: timestamp(year, month, 25, 10, 0),
    direction: "IN",
    amount: 1_650_000,
    counterpartyName: "한결시니어센터",
    counterpartyBank: "기업은행",
    category: "INCOME",
    transactionType: "SALARY",
    channel: "ACCOUNT_CREDIT",
    memo: "급여",
    recurring: true,
  });

  // 가족·주거·저축: 고정된 수취인과 자동이체 중심의 반복 패턴이다.
  addTransaction({
    occurredAt: timestamp(year, month, 10, 13, 7),
    direction: "OUT",
    amount: month === 1 || month === 5 ? 700_000 : 500_000,
    counterpartyName: "딸 지혜",
    counterpartyBank: "국민은행",
    category: "FAMILY",
    transactionType: "TRANSFER",
    channel: "MOBILE_TRANSFER",
    memo: "가족 생활비",
    recurring: true,
  });
  addTransaction({
    occurredAt: timestamp(year, month, 17, 9, 0),
    direction: "OUT",
    amount: 184_000 + integer(-8_000, 12_000),
    counterpartyName: "아파트 관리비",
    counterpartyBank: "하나은행",
    category: "HOUSING",
    transactionType: "AUTOPAY",
    channel: "AUTO_TRANSFER",
    memo: "관리비",
    recurring: true,
  });
  addTransaction({
    occurredAt: timestamp(year, month, 20, 9, 0),
    direction: "OUT",
    amount: 1_000_000,
    counterpartyName: "토스뱅크 정기적금",
    counterpartyBank: "토스뱅크",
    category: "SAVINGS",
    transactionType: "AUTOPAY",
    channel: "AUTO_TRANSFER",
    memo: "정기적금",
    recurring: true,
  });
  addTransaction({
    occurredAt: timestamp(year, month, 22, 9, 0),
    direction: "OUT",
    amount: month >= 11 || month <= 3 ? integer(70_000, 118_000) : integer(24_000, 52_000),
    counterpartyName: "도시가스",
    counterpartyBank: "한결은행",
    category: "HOUSING",
    transactionType: "AUTOPAY",
    channel: "AUTO_TRANSFER",
    memo: "가스요금",
    recurring: true,
  });
  addTransaction({
    occurredAt: timestamp(year, month, 25, 9, 0),
    direction: "OUT",
    amount: month >= 6 && month <= 8 ? integer(78_000, 112_000) : integer(42_000, 69_000),
    counterpartyName: "한국전력",
    counterpartyBank: "한결은행",
    category: "HOUSING",
    transactionType: "AUTOPAY",
    channel: "AUTO_TRANSFER",
    memo: "전기요금",
    recurring: true,
  });
  addTransaction({
    occurredAt: timestamp(year, month, 27, 9, 0),
    direction: "OUT",
    amount: 38_500,
    counterpartyName: "한결통신",
    counterpartyBank: "한결은행",
    category: "HOUSING",
    transactionType: "AUTOPAY",
    channel: "AUTO_TRANSFER",
    memo: "통신비",
    recurring: true,
  });
  addTransaction({
    occurredAt: timestamp(year, month, 28, 9, 0),
    direction: "OUT",
    amount: 128_000,
    counterpartyName: "안심생명",
    counterpartyBank: "신한은행",
    category: "INSURANCE",
    transactionType: "AUTOPAY",
    channel: "AUTO_TRANSFER",
    memo: "보험료",
    recurring: true,
  });

  // 생활 소비: 낮 시간대, 소액, 익숙한 가맹점 위주의 반복 지출이다.
  const groceryStores = ["시장 상회", "하나로마트", "이마트"];
  for (let index = 0; index < 12; index += 1) {
    const day = integer(1, lastDay);
    addTransaction({
      occurredAt: timestamp(year, month, day, integer(9, 17), integer(0, 59)),
      direction: "OUT",
      amount: integer(18_000, 92_000),
      counterpartyName: pick(groceryStores),
      counterpartyBank: "한결카드",
      category: "GROCERIES",
      transactionType: "CARD",
      channel: "DEBIT_CARD",
      memo: "식료품",
    });
  }

  for (let index = 0; index < 3; index += 1) {
    const day = integer(1, lastDay);
    addTransaction({
      occurredAt: timestamp(year, month, day, integer(10, 16), integer(0, 59)),
      direction: "OUT",
      amount: integer(9_000, 48_000),
      counterpartyName: "약국",
      counterpartyBank: "한결카드",
      category: "HEALTHCARE",
      transactionType: "CARD",
      channel: "DEBIT_CARD",
      memo: "의약품",
    });
  }

  for (let index = 0; index < 4; index += 1) {
    const day = integer(1, lastDay);
    addTransaction({
      occurredAt: timestamp(year, month, day, integer(8, 18), integer(0, 59)),
      direction: "OUT",
      amount: pick([1_400, 1_500, 2_800, 3_000, 5_000]),
      counterpartyName: pick(["한결교통", "서울교통공사", "마을버스"]),
      counterpartyBank: "한결카드",
      category: "TRANSPORT",
      transactionType: "CARD",
      channel: "DEBIT_CARD",
      memo: "교통",
    });
  }

  for (let index = 0; index < 2; index += 1) {
    const day = integer(1, lastDay);
    addTransaction({
      occurredAt: timestamp(year, month, day, integer(11, 19), integer(0, 59)),
      direction: "OUT",
      amount: integer(8_000, 38_000),
      counterpartyName: pick(["동네식당", "한결분식", "카페"]),
      counterpartyBank: "한결카드",
      category: "DINING",
      transactionType: "CARD",
      channel: "DEBIT_CARD",
      memo: "외식",
    });
  }

  // 분기 수도요금과 계절성 의료비로 지나치게 기계적인 반복을 피한다.
  if ([10, 1, 4, 7].includes(month)) {
    addTransaction({
      occurredAt: timestamp(year, month, 15, 9, 0),
      direction: "OUT",
      amount: integer(28_000, 46_000),
      counterpartyName: "상하수도사업본부",
      counterpartyBank: "한결은행",
      category: "HOUSING",
      transactionType: "AUTOPAY",
      channel: "AUTO_TRANSFER",
      memo: "수도요금",
      recurring: true,
    });
  }

  if ([11, 3, 8].includes(month)) {
    addTransaction({
      occurredAt: timestamp(year, month, Math.min(14, lastDay), 11, 20),
      direction: "OUT",
      amount: integer(55_000, 145_000),
      counterpartyName: "한결정형외과",
      counterpartyBank: "한결카드",
      category: "HEALTHCARE",
      transactionType: "CARD",
      channel: "DEBIT_CARD",
      memo: "진료비",
    });
  }
}

// 현실적인 비정기 정상 거래. 사기 시연용 고액 신규계좌 송금은 과거 이력에 넣지 않는다.
addTransaction({
  occurredAt: "2025-12-12T14:35:00+09:00",
  direction: "OUT",
  amount: 2_380_000,
  counterpartyName: "한결가전",
  counterpartyBank: "한결카드",
  category: "HOUSEHOLD",
  transactionType: "CARD",
  channel: "DEBIT_CARD",
  memo: "냉장고 구입",
});
addTransaction({
  occurredAt: "2026-05-08T11:10:00+09:00",
  direction: "IN",
  amount: 320_000,
  counterpartyName: "딸 지혜",
  counterpartyBank: "국민은행",
  category: "FAMILY",
  transactionType: "TRANSFER",
  channel: "MOBILE_TRANSFER",
  memo: "어버이날 용돈",
});

// 02: 자영업형 — 카드매출 정산과 익숙한 거래처 송금이 크고 자주 발생한다.
activeProfile = PROFILES[1];
for (const [year, month] of months) {
  const lastDay = daysInMonth(year, month);
  for (let index = 0; index < 12; index += 1) {
    addTransaction({
      occurredAt: timestamp(year, month, integer(1, lastDay), integer(10, 18), integer(0, 59)),
      direction: "IN",
      amount: integer(180_000, 720_000),
      counterpartyName: "한결시장 카드매출",
      counterpartyBank: "한결은행",
      category: "BUSINESS_INCOME",
      transactionType: "SALE_SETTLEMENT",
      channel: "ACCOUNT_CREDIT",
      memo: "매출정산",
    });
  }
  for (let index = 0; index < 6; index += 1) {
    const supplier = pick(["한결식자재", "우리유통", "동네농산"]);
    addTransaction({
      occurredAt: timestamp(year, month, integer(1, lastDay), integer(9, 17), integer(0, 59)),
      direction: "OUT",
      amount: integer(220_000, 920_000),
      counterpartyName: supplier,
      counterpartyBank: supplier === "우리유통" ? "우리은행" : "농협",
      category: "BUSINESS_EXPENSE",
      transactionType: "TRANSFER",
      channel: "MOBILE_TRANSFER",
      memo: "거래처 대금",
    });
  }
  addTransaction({
    occurredAt: timestamp(year, month, 5, 9, 0),
    direction: "OUT",
    amount: 700_000,
    counterpartyName: "한결시장 상가임대",
    counterpartyBank: "한결은행",
    category: "HOUSING",
    transactionType: "AUTOPAY",
    channel: "AUTO_TRANSFER",
    memo: "상가 임대료",
    recurring: true,
  });
  addTransaction({
    occurredAt: timestamp(year, month, 14, 9, 0),
    direction: "OUT",
    amount: integer(110_000, 220_000),
    counterpartyName: "한국전력",
    counterpartyBank: "한결은행",
    category: "BUSINESS_EXPENSE",
    transactionType: "AUTOPAY",
    channel: "AUTO_TRANSFER",
    memo: "사업장 전기요금",
    recurring: true,
  });
  addTransaction({
    occurredAt: timestamp(year, month, 18, 11, 10),
    direction: "OUT",
    amount: 600_000,
    counterpartyName: "배우자 최은희",
    counterpartyBank: "신한은행",
    category: "FAMILY",
    transactionType: "TRANSFER",
    channel: "MOBILE_TRANSFER",
    memo: "가족 생활비",
    recurring: true,
  });
  for (let index = 0; index < 8; index += 1) {
    addTransaction({
      occurredAt: timestamp(year, month, integer(1, lastDay), integer(8, 20), integer(0, 59)),
      direction: "OUT",
      amount: integer(12_000, 85_000),
      counterpartyName: pick(["하나로마트", "시장 상회", "주유소", "동네식당"]),
      counterpartyBank: "한결카드",
      category: "CONSUMPTION",
      transactionType: "CARD",
      channel: "DEBIT_CARD",
      memo: "생활비",
    });
  }
}

// 03: 연금·의료형 — 소액 생활비와 병원·약국 지출 비중이 높다.
activeProfile = PROFILES[2];
for (const [year, month] of months) {
  const lastDay = daysInMonth(year, month);
  addTransaction({
    occurredAt: timestamp(year, month, 3, 8, 30),
    direction: "IN",
    amount: 1_184_000,
    counterpartyName: "국민연금공단",
    counterpartyBank: "한결은행",
    category: "INCOME",
    transactionType: "PENSION",
    channel: "ACCOUNT_CREDIT",
    memo: "국민연금",
    recurring: true,
  });
  addTransaction({
    occurredAt: timestamp(year, month, 8, 10, 15),
    direction: "IN",
    amount: 300_000,
    counterpartyName: "아들 준호",
    counterpartyBank: "국민은행",
    category: "FAMILY",
    transactionType: "TRANSFER",
    channel: "MOBILE_TRANSFER",
    memo: "부모님 생활비",
    recurring: true,
  });
  addTransaction({
    occurredAt: timestamp(year, month, 17, 9, 0),
    direction: "OUT",
    amount: 156_000 + integer(-7_000, 10_000),
    counterpartyName: "아파트 관리비",
    counterpartyBank: "하나은행",
    category: "HOUSING",
    transactionType: "AUTOPAY",
    channel: "AUTO_TRANSFER",
    memo: "관리비",
    recurring: true,
  });
  addTransaction({
    occurredAt: timestamp(year, month, 25, 9, 0),
    direction: "OUT",
    amount: integer(38_000, 78_000),
    counterpartyName: "한국전력",
    counterpartyBank: "한결은행",
    category: "HOUSING",
    transactionType: "AUTOPAY",
    channel: "AUTO_TRANSFER",
    memo: "전기요금",
    recurring: true,
  });
  addTransaction({
    occurredAt: timestamp(year, month, 28, 9, 0),
    direction: "OUT",
    amount: 92_000,
    counterpartyName: "든든보험",
    counterpartyBank: "한결은행",
    category: "INSURANCE",
    transactionType: "AUTOPAY",
    channel: "AUTO_TRANSFER",
    memo: "보험료",
    recurring: true,
  });
  for (let index = 0; index < 10; index += 1) {
    addTransaction({
      occurredAt: timestamp(year, month, integer(1, lastDay), integer(9, 17), integer(0, 59)),
      direction: "OUT",
      amount: integer(12_000, 64_000),
      counterpartyName: pick(["시장 상회", "하나로마트", "동네반찬"]),
      counterpartyBank: "한결카드",
      category: "GROCERIES",
      transactionType: "CARD",
      channel: "DEBIT_CARD",
      memo: "식료품",
    });
  }
  for (let index = 0; index < 5; index += 1) {
    const medical = pick(["약국", "한결내과", "한결정형외과"]);
    addTransaction({
      occurredAt: timestamp(year, month, integer(1, lastDay), integer(9, 16), integer(0, 59)),
      direction: "OUT",
      amount: medical === "약국" ? integer(8_000, 45_000) : integer(24_000, 118_000),
      counterpartyName: medical,
      counterpartyBank: "한결카드",
      category: "HEALTHCARE",
      transactionType: "CARD",
      channel: "DEBIT_CARD",
      memo: medical === "약국" ? "의약품" : "진료비",
    });
  }
  for (let index = 0; index < 4; index += 1) {
    addTransaction({
      occurredAt: timestamp(year, month, integer(1, lastDay), integer(8, 18), integer(0, 59)),
      direction: "OUT",
      amount: pick([1_400, 1_500, 2_800, 3_000]),
      counterpartyName: pick(["한결교통", "서울교통공사", "마을버스"]),
      counterpartyBank: "한결카드",
      category: "TRANSPORT",
      transactionType: "CARD",
      channel: "DEBIT_CARD",
      memo: "교통",
    });
  }
}

transactions.sort((left, right) => left.user_id.localeCompare(right.user_id)
  || left.occurred_at.localeCompare(right.occurred_at));

const openingBalances = new Map(PROFILES.map((profile) => {
  const netChange = transactions
    .filter((transaction) => transaction.user_id === profile.user_id)
    .reduce(
      (sum, transaction) => sum + (transaction.direction === "IN" ? transaction.amount : -transaction.amount),
      0,
    );
  return [profile.user_id, profile.target_end_balance - netChange];
}));
const balances = new Map(openingBalances);

const headers = [
  "id", "user_id", "account_id", "occurred_at", "direction", "amount", "balance_after",
  "counterparty_name", "counterparty_bank", "counterparty_account_hash", "category",
  "transaction_type", "channel", "memo", "is_recurring", "is_synthetic",
];

const rows = transactions.map((transaction, index) => {
  const balance = balances.get(transaction.user_id)
    + (transaction.direction === "IN" ? transaction.amount : -transaction.amount);
  balances.set(transaction.user_id, balance);
  return {
    id: `txn-${transaction.user_id.slice(-2)}-${String(index + 1).padStart(4, "0")}`,
    ...transaction,
    balance_after: balance,
    is_synthetic: true,
  };
});

const csv = [
  headers.join(","),
  ...rows.map((row) => headers.map((header) => csvValue(row[header])).join(",")),
].join("\n");

const userHeaders = [
  "user_id", "display_name", "profile_type", "age_band", "account_id",
  "account_name", "bank_name", "analysis_window_months", "is_synthetic",
];
const usersCsv = [
  userHeaders.join(","),
  ...PROFILES.map((profile) => userHeaders.map((header) => csvValue({
    ...profile,
    analysis_window_months: 12,
    is_synthetic: true,
  }[header])).join(",")),
].join("\n");

await mkdir(dirname(TRANSACTIONS_OUTPUT_PATH), { recursive: true });
await writeFile(TRANSACTIONS_OUTPUT_PATH, `${csv}\n`, "utf8");
await writeFile(USERS_OUTPUT_PATH, `${usersCsv}\n`, "utf8");

const countsByCategory = Object.fromEntries(
  [...new Set(rows.map((row) => row.category))]
    .sort()
    .map((category) => [category, rows.filter((row) => row.category === category).length]),
);

console.log(JSON.stringify({
  outputs: {
    users: USERS_OUTPUT_PATH,
    transactions: TRANSACTIONS_OUTPUT_PATH,
  },
  rows: rows.length,
  profiles: PROFILES.map((profile) => {
    const profileRows = rows.filter((row) => row.user_id === profile.user_id);
    return {
      user_id: profile.user_id,
      period: [profileRows[0].occurred_at, profileRows.at(-1).occurred_at],
      rows: profileRows.length,
      ending_balance: balances.get(profile.user_id),
    };
  }),
  categories: countsByCategory,
}, null, 2));
