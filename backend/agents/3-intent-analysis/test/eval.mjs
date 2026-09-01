// 3단계 의도 분석 평가셋 러너
//
//   node backend/eval.mjs [baseUrl]
//
// 개발 서버가 떠 있어야 한다. 기본 http://localhost:5173

const BASE = process.argv[2] || "http://localhost:5173";

// 판정 규칙과 같은 상한을 쓴다 (signals.js MAX_TURNS)
const MAX_TURNS = 4;

const u = (text) => ({ role: "user", text });
const a = (text) => ({ role: "ai", text });

/** expect: "hold" = 보류되어야 함, "pass" = 통과되어야 함(보류 금지) */
const CASES = [
  // ── 사기 시나리오 (보류되어야 함) ──
  {
    name: "기관사칭 환급 수수료",
    expect: "hold",
    amount: 3_000_000,
    turns: [
      [u("환급 받으려면 수수료를 먼저 내야 한다고 해서요")],
      [a("어디서 연락받으셨나요?"), u("구청에서 문자가 왔어요. 오늘까지 안 내면 안 된대요")],
    ],
  },
  {
    name: "검찰사칭 원격앱+통화중",
    expect: "hold",
    amount: 5_000_000,
    turns: [
      [u("검찰청에서 전화왔는데 계좌가 범죄에 연루됐대요. 앱 깔라고 해서 깔았고 지금 통화중이에요")],
    ],
  },
  {
    name: "대출 보증금 선입금",
    expect: "hold",
    amount: 2_000_000,
    turns: [
      [u("대출을 받으려는데 보증금을 먼저 넣어야 한다고 해서요")],
      [a("어디서 연락받으셨나요?"), u("문자로 저금리 대출 광고가 와서 전화했어요. 지금 통화중이에요")],
    ],
  },
  {
    name: "안전계좌 이동 유도",
    expect: "hold",
    amount: 8_000_000,
    turns: [
      [u("금감원에서 제 계좌가 위험하니 안전계좌로 옮기라고 했어요. 아무한테도 말하지 말래요")],
    ],
  },

  // ── 정상 거래 (통과되어야 함 = 오탐 검사) ──
  {
    name: "손녀 등록금",
    expect: "pass",
    amount: 1_500_000,
    turns: [
      [u("손녀 대학 등록금 보태주려고요. 며느리 계좌예요. 어제 직접 만나서 얘기했어요")],
      [a("확인 감사합니다"), u("네 제가 주고 싶어서 보내는 거예요")],
    ],
  },
  {
    name: "동생 병원비",
    expect: "pass",
    amount: 800_000,
    turns: [
      [u("동생 병원비예요. 제가 보내주기로 했어요")],
      [a("어떻게 이야기가 되셨나요?"), u("지난 주말에 병원에서 직접 만나서 얘기했어요")],
    ],
  },
  {
    name: "경조사비",
    expect: "pass",
    amount: 500_000,
    turns: [
      [u("친구 아들 결혼식이라 축의금 보내요")],
      [a("직접 연락받으셨나요?"), u("청첩장 받았고 친구랑 어제 통화했어요")],
    ],
  },
];

const post = (body) =>
  fetch(`${BASE}/api/intent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());

let pass = 0, fail = 0, fellBack = 0;
const failures = [];

console.log(`\n평가셋 실행 — ${BASE}\n${"─".repeat(78)}`);

for (const c of CASES) {
  let messages = [];
  let last = null;

  // 결론이 날 때까지 대화를 끝까지 이어간다.
  // 규칙상 최소 질문 수를 채워야 판정이 나오므로, 대본이 끝나면
  // 새 정보를 주지 않는 중립 답변("네")으로 남은 턴을 채운다.
  for (let i = 0; i < MAX_TURNS; i++) {
    messages = [...messages, ...(c.turns[i] ?? [u("네")])];
    last = await post({
      transfer: { amount: c.amount, account: "356-0912-4421", bank: "기업은행" },
      messages,
      turn: i + 1,
    });
    if (last.error) break;
    messages.push({ role: "ai", text: last.message });
    if (last.done) break;
    await new Promise((r) => setTimeout(r, 400));
  }

  if (last?.error) {
    fail++;
    failures.push(`${c.name}: API 오류 — ${last.error.slice(0, 90)}`);
    console.log(`✗ ${c.name.padEnd(24)} API 오류`);
    continue;
  }

  if (last.fallback) fellBack++;

  const ok = c.expect === "hold" ? last.hold === true : last.hold === false;
  ok ? pass++ : fail++;
  if (!ok) failures.push(`${c.name}: ${c.expect} 기대했으나 hold=${last.hold}`);

  console.log(
    `${ok ? "✓" : "✗"} ${c.name.padEnd(24)} ` +
    `기대=${c.expect.padEnd(4)} 점수=${String(last.risk.score).padStart(3)} ` +
    `보류=${String(last.hold).padEnd(5)} ${last.fallback ? "[폴백] " : ""}` +
    `${last.risk.labels.join(", ")}`
  );
  await new Promise((r) => setTimeout(r, 600));
}

console.log("─".repeat(78));
console.log(`통과 ${pass}/${CASES.length}   실패 ${fail}   폴백 ${fellBack}`);
if (failures.length) {
  console.log("\n실패 상세:");
  failures.forEach((f) => console.log(`  · ${f}`));
}
console.log();
process.exit(fail ? 1 : 0);
