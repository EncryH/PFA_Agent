// 데모용 고정 데이터와 위험 판정 헬퍼.
// 실서비스에서는 은행 코어뱅킹 · 신고 DB 조회로 대체되는 자리.

export type Role = "parent" | "child";

export type TransferStep =
  | "input"      // 어디로 보낼까요 — 최근 계좌 고르거나 직접 입력으로 진입
  | "account"    // 어떤 계좌로 보낼까요 — 계좌번호 + 은행
  | "amount"     // 얼마를 보낼까요 — 금액
  | "confirm"    // 마지막 확인 — 실제 은행처럼 보내기 직전에 한 번 더 보여준다
  | "checking" | "success" | "db-warning" | "ai-chat" | "hold" | "already-sent";

// 본인 명의 계좌 — 여기로 보내는 건 사기가 될 수 없으므로 항상 무마찰 통과
export const MY_ACCOUNTS = [
  { name: "한결은행 입출금통장", account: "1101234567", bank: "한결은행", balance: "21,470,000" },
  { name: "토스뱅크 정기적금",   account: "1000751604", bank: "토스뱅크", balance: "70,000,000" },
  { name: "쏠편한 정기예금",     account: "1102223333", bank: "신한은행", balance: "34,000,000" },
];

// 자녀(김지혜) 계좌 — 부모와 다른 은행이라는 걸 화면으로 보여주기 위한 데이터
export const CHILD_ACCOUNT = {
  name: "자유입출금", account: "35615324608", bank: "나눔은행", balance: "2,840,000",
};

export const KNOWN_RECIPIENTS = [
  { name: "딸 지혜",       account: "0102345678", bank: "국민은행", maxSafe: 1000000 },
  { name: "시장 상회",     account: "1103456789", bank: "농협",     maxSafe: 500000  },
  { name: "아파트 관리비", account: "0790123456", bank: "하나은행", maxSafe: 1000000 },
  { name: "약국",          account: "1105678901", bank: "국민은행", maxSafe: 200000  },
];

// 신고된 계좌 (더치트 DB 시뮬레이션)
export const BLACKLISTED_ACCOUNTS = ["1104421783", "1104421"];

export const BANKS = [
  "한결은행", "나눔은행", "국민은행", "신한은행", "우리은행", "하나은행",
  "농협", "기업은행", "산업은행", "수협", "우체국",
  "카카오뱅크", "토스뱅크", "케이뱅크",
  "새마을금고", "신협",
];

export const BROKERAGES = [
  "미래에셋증권", "삼성증권", "NH투자증권", "키움증권", "한국투자증권",
  "KB증권", "신한투자증권", "하나증권", "대신증권", "메리츠증권",
  "교보증권", "유안타증권", "신영증권", "현대차증권", "한화투자증권",
  "DB금융투자",
];

// ─── Helper functions ─────────────────────────────────────────────────────
export const fmtAccount = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length <= 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 11)}-${d.slice(11)}`;
};

export const fmtAmt = (v: string) => {
  const d = v.replace(/\D/g, "");
  return d ? parseInt(d).toLocaleString() : "";
};

export const parseAmt = (v: string) => parseInt(v.replace(/,/g, ""), 10) || 0;

/** 계좌별 거래내역 — 계좌번호를 키로 쓴다. amount 가 양수면 입금, 음수면 출금. */
export type TxnRow = { date: string; time: string; name: string; memo: string; amount: number; balance: number };

export const TRANSACTIONS: Record<string, TxnRow[]> = {
  // 한결은행 입출금통장 — 연금이 들어오고 생활비가 나가는 주거래 계좌
  "1101234567": [
    { date: "08.17", time: "09:00", name: "아파트 관리비",     memo: "자동이체", amount:   -184_000, balance: 21_470_000 },
    { date: "08.15", time: "15:22", name: "약국",              memo: "체크카드", amount:    -32_400, balance: 21_654_000 },
    { date: "08.13", time: "10:41", name: "시장 상회",         memo: "이체",     amount:   -150_000, balance: 21_686_400 },
    { date: "08.10", time: "13:07", name: "딸 지혜",           memo: "이체",     amount:   -500_000, balance: 21_836_400 },
    { date: "08.03", time: "08:30", name: "국민연금공단",      memo: "연금",     amount:  1_012_000, balance: 22_336_400 },
    { date: "07.28", time: "09:00", name: "안심생명",          memo: "보험료",   amount:   -128_000, balance: 21_324_400 },
    { date: "07.25", time: "09:00", name: "한국전력",          memo: "자동이체", amount:    -46_800, balance: 21_452_400 },
    { date: "07.22", time: "16:55", name: "약국",              memo: "체크카드", amount:    -18_600, balance: 21_499_200 },
    { date: "07.20", time: "09:00", name: "토스뱅크 정기적금", memo: "자동이체", amount: -1_000_000, balance: 21_517_800 },
    { date: "07.03", time: "08:30", name: "국민연금공단",      memo: "연금",     amount:  1_012_000, balance: 22_517_800 },
  ],
  // 토스뱅크 정기적금 — 매월 자동이체로만 쌓인다
  "1000751604": [
    { date: "08.10", time: "05:00", name: "이자",     memo: "예금이자", amount:   142_000, balance: 70_000_000 },
    { date: "07.10", time: "09:00", name: "정기적금", memo: "자동이체", amount: 1_000_000, balance: 69_858_000 },
    { date: "06.10", time: "09:00", name: "정기적금", memo: "자동이체", amount: 1_000_000, balance: 68_858_000 },
    { date: "05.10", time: "09:00", name: "정기적금", memo: "자동이체", amount: 1_000_000, balance: 67_858_000 },
    { date: "04.10", time: "09:00", name: "정기적금", memo: "자동이체", amount: 1_000_000, balance: 66_858_000 },
  ],
  // 나눔은행 자유입출금 (자녀 김지혜) — 급여가 들어오고 생활비가 나간다
  "35615324608": [
    { date: "08.17", time: "12:31", name: "카페",          memo: "체크카드", amount:    -5_500, balance:  2_840_000 },
    { date: "08.15", time: "19:04", name: "편의점",        memo: "체크카드", amount:   -12_800, balance:  2_845_500 },
    { date: "08.13", time: "09:00", name: "통신비",        memo: "자동이체", amount:   -55_000, balance:  2_858_300 },
    { date: "08.10", time: "20:15", name: "어머니 김영순", memo: "이체",     amount:  -300_000, balance:  2_913_300 },
    { date: "08.08", time: "09:00", name: "카드대금",      memo: "자동이체", amount:  -742_000, balance:  3_213_300 },
    { date: "08.01", time: "10:00", name: "급여",          memo: "입금",     amount: 3_150_000, balance:  3_955_300 },
    { date: "07.25", time: "09:00", name: "월세",          memo: "자동이체", amount:  -700_000, balance:    805_300 },
    { date: "07.01", time: "10:00", name: "급여",          memo: "입금",     amount: 3_150_000, balance:  1_505_300 },
  ],
  // 쏠편한 정기예금 — 목돈을 넣어두고 이자만 붙는다
  "1102223333": [
    { date: "08.15", time: "05:00", name: "이자",          memo: "예금이자", amount:    248_000, balance: 34_000_000 },
    { date: "05.15", time: "05:00", name: "이자",          memo: "예금이자", amount:    246_000, balance: 33_752_000 },
    { date: "02.15", time: "05:00", name: "이자",          memo: "예금이자", amount:    244_000, balance: 33_506_000 },
    { date: "11.15", time: "11:20", name: "정기예금 예치", memo: "신규",     amount: 33_262_000, balance: 33_262_000 },
  ],
};

// ─── 알림 기록 ────────────────────────────────────────────────────────────
// 알림함은 '지금 상태'가 아니라 '지나간 사건'을 보여준다.
// 연결을 해제해도 연결됐던 알림은 남아야 하므로 로그로 쌓는다.
// 실서비스에서는 감사 로그(조치내역 5년 보존)가 들어갈 자리.

export type NoticeEvent = {
  type: "paired" | "unpaired" | "level-changed";
  at: string;
  /** level-changed 일 때만 — 바뀐 전후 보호 단계 */
  from?: number;
  to?: number;
};

const NOTICE_KEY = "ansimNotices";

export const readNotices = (): NoticeEvent[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(NOTICE_KEY) ?? "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
};

export const pushNotice = (
  type: NoticeEvent["type"],
  at = new Date().toISOString(),
  extra: Pick<NoticeEvent, "from" | "to"> = {},
) => {
  const list = readNotices();
  list.push({ type, at, ...extra });
  localStorage.setItem(NOTICE_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("ansim-notice"));
};

/** 데모용 예금주 조회 — 실제로는 금융결제원 조회. 같은 계좌번호면 항상 같은 이름이 나온다. */
const HOLDER_POOL = ["김민수", "이서연", "박지훈", "최유진", "정도현", "강수아", "윤태경", "임하늘"];
export const lookupHolder = (account: string) => {
  const clean = account.replace(/\D/g, "");
  if (clean.length < 8) return "";

  if (isMyAccount(account)) return "본인";

  const known = KNOWN_RECIPIENTS.find((k) => clean.includes(k.account.slice(0, 8)));
  if (known) return known.name;

  const sum = [...clean].reduce((a, c) => a + Number(c), 0);
  return HOLDER_POOL[sum % HOLDER_POOL.length];
};

/** 본인 명의 계좌인지 — 맞으면 금액과 무관하게 검사 대상이 아니다. */
export const isMyAccount = (account: string) => {
  const clean = account.replace(/\D/g, "");
  return clean.length >= 8 && MY_ACCOUNTS.some((m) => clean.includes(m.account.slice(0, 8)));
};

/** 3층 거래 검사 — 패턴 룰. 0점이면 즉시 송금(무마찰). */
export const runRisk = (account: string, amt: number, name: string): "success" | "db-warning" | "ai-chat" => {
  const clean = account.replace(/\D/g, "");

  // 내 계좌 간 이체는 사기가 성립하지 않는다 — 항상 통과
  if (isMyAccount(account)) return "success";

  if (BLACKLISTED_ACCOUNTS.some((b) => clean.length >= 7 && clean.includes(b.slice(0, 7))))
    return "db-warning";

  const known = KNOWN_RECIPIENTS.find(
    (k) => (clean.length >= 8 && clean.includes(k.account.slice(0, 8))) || name === k.name
  );

  if (known && amt > 0 && amt <= known.maxSafe) return "success";

  let score = 0;
  if (!known && clean.length >= 8) score += 25;
  if (amt >= 300000) score += 10;
  if (amt >= 1000000) score += 15;
  if (amt >= 3000000) score += 20;

  return score >= 35 ? "ai-chat" : "success";
};

// ─── 자녀 화면 시드 데이터 ────────────────────────────────────────────────
export const DEMO_ALERT = {
  parentName: "어머니 김영순",
  amount: 3000000,
  account: "기업 356-0912-4421-83",
  bank: "기업은행",
  risk: "HIGH",
  signals: ["선입금 모순", "기관 사칭", "긴급성 강요"],
  aiSummary: '"환급 수수료" 명목 — 구청 사칭 문자 후 송금 요청. 선입금 모순 탐지됨.',
  conversation: [
    { role: "ai",   text: "처음 보내는 계좌예요. 어떤 돈인지 여쭤봐도 될까요? 😊" },
    { role: "user", text: "환급 받으려면 수수료를 먼저 내야 한다고 해서요" },
    { role: "ai",   text: "구청이나 기관에서 연락을 받으신 건가요? 전화로 오셨나요, 문자로 오셨나요?" },
    { role: "user", text: "문자로 왔어요. 오늘까지라고 하더라고요" },
    { role: "ai",   text: "⚠️ 주의가 필요해요.\n환급을 받으려면 수수료를 먼저 내야 한다는 건 보이스피싱의 대표 수법이에요." },
  ],
  time: "오후 2:07",
};

export type DemoAlert = typeof DEMO_ALERT;

// ─── 적금·예금 상세 정보 ──────────────────────────────────────────────────────
export const SAVINGS_INFO: Record<string, {
  type: string;
  rate: number;
  penaltyRate: number;
  maturityDate: string;
  startDate: string;
  monthlyAmt: number | null;
  totalDeposited: number;
  earnedInterest: number;
  penaltyAmount: number;
  afterPenaltyBalance: number;
  mainAccountName: string;
}> = {
  "1000751604": {
    type: "정기적금",
    rate: 5.2,
    penaltyRate: 2.6,
    maturityDate: "2027-08-20",
    startDate: "2026-08-20",
    monthlyAmt: 1_000_000,
    totalDeposited: 70_000_000,
    earnedInterest: 142_000,
    penaltyAmount: 71_000,
    afterPenaltyBalance: 70_071_000,
    mainAccountName: "한결은행 입출금통장",
  },
  "1102223333": {
    type: "정기예금",
    rate: 4.8,
    penaltyRate: 2.4,
    maturityDate: "2027-03-15",
    startDate: "2026-03-15",
    monthlyAmt: null,
    totalDeposited: 34_000_000,
    earnedInterest: 738_000,
    penaltyAmount: 369_000,
    afterPenaltyBalance: 34_369_000,
    mainAccountName: "한결은행 입출금통장",
  },
};

export const nowTime = () =>
  new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
