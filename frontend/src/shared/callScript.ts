// 통화 데모용 대사 스크립트 — 실제 녹취를 못 구해서(개인정보·저작권 문제), 공공기관이
// 공개한 신고 사례에 반복적으로 나오는 수법을 바탕으로 새로 쓴 대사다. 실제 인물·통화
// 원본은 없고, 등장하는 이름(검찰·법원·카드사·대출상담사 등)도 전부 가상이다. 5가지
// 시나리오 각각이 shared/callscreen.ts의 특정 발신번호에 고정 배정된다(pickCallScript
// 참고) — 심사 시 같은 번호로 걸면 항상 같은 시나리오가 재현돼야 하기 때문이다.
//
// 통화 화면이 이 대사를 자막으로 한 줄씩 띄우고, 특정 줄에 달린 flags를 통해
// "이체한도를 올리라는 말이 나왔는지" / "적금을 해지하라는 말이 나왔는지" /
// "구체적인 송금 요구가 나왔는지"를 감지한다. 감지된 사실은 shared/callActivity.ts에
// 저장돼, 이체한도 상향 화면·적금 해지 화면·송금 화면에서 각각 참조한다.
//
// closingGuidance: 경고 화면 맨 아래 "이렇게 확인하세요" 문구. 시나리오마다 사칭 대상이
// 달라서(검찰/법원/카드사/대출상담사/납치범) "검찰·경찰·금융기관은..." 같은 고정
// 문구 하나로는 안 맞는 시나리오가 생긴다(특히 5번은 기관 사칭이 아예 아니다) — 5개뿐이라
// 시나리오별로 직접 써서 하드코딩한다.

export type ScriptFlag = "limitIncreaseRequest" | "savingsCloseRequest" | "transferRequest";

export interface LinkMessagePreview {
  sender: string;
  body: string;
  url: string;
}

export interface ScriptLine {
  text: string;
  flags?: ScriptFlag[];
  // 이 대사가 AI로 합성된(딥보이스) 목소리로 연출되는 지점인지 — 통화 카드에 별도
  // 배지("AI 음성 변조 의심")로 표시한다. 실제 최신 보이스피싱 수법 중 하나다.
  voiceClone?: boolean;
  // 이 줄에서 "통화 중 문자로 링크를 보냈다"는 연출을 트리거한다 — 하단 자막이 아니라
  // 통화 카드 바로 아래에 실제 문자 알림 배너 스타일로 뜨고, 통화가 끝날 때까지 남아있는다.
  linkMessage?: LinkMessagePreview;
  // 이 줄이 그 링크에 대한 실시간 탐지 결과인지 — 하단 자막에 빨간 경고 스타일로 보여준다.
  // KISA 국내 피싱사이트 목록에 실제로 등록된 도메인을 대사에 그대로 써서, 상대방
  // 검증(Verify) 화면에서 같은 링크를 직접 조회해도 실제로 위험 판정이 나오게 맞췄다.
  detectionAlert?: boolean;
}

export interface CallScript {
  id: string;
  lines: ScriptLine[];
  closingGuidance: string;
}

// 1) 검찰 사칭 안전계좌 — "명의도용 자금세탁 수사"를 빌미로 비밀 유지와 통화 유지를
//    요구하며, 이체한도를 상향시킨 뒤 안전계좌로 자금을 옮기라고 지시하는 가장 널리
//    알려진 전형적인 기관사칭형 보이스피싱 패턴.
const PROSECUTOR_SAFE_ACCOUNT: CallScript = {
  id: "prosecutor-safe-account",
  closingGuidance: "검찰·경찰·금융기관은 전화로 안전계좌 이체나 이체한도 상향을 요구하지 않아요. 지금 통화를 끊고 대검찰청 대표번호(국번없이 1301)로 직접 확인하세요.",
  lines: [
    { text: "여보세요, 서울중앙지방검찰청 금융범죄수사부 김도현 수사관입니다." },
    { text: "본인 확인부터 하겠습니다. 성함과 생년월일 말씀해 주시겠어요." },
    { text: "선생님 명의로 개설된 계좌가 대포통장 유통 조직의 자금세탁 사건에 이용된 정황이 확인됐습니다." },
    { text: "현재 관련자 20여 명을 특정해서 비공개로 수사를 진행하고 있는 단계입니다." },
    { text: "수사 내용이 새어 나가면 증거 인멸 우려가 있어서, 이 통화 내용은 가족이나 은행 직원 누구에게도 말씀하시면 안 됩니다." },
    { text: "지금부터 안내드리는 절차가 끝날 때까지 전화는 끊지 말고 계속 통화 상태를 유지해 주세요." },
    { text: "선생님 계좌가 사건에 연루되지 않았다는 걸 증명하려면, 자금 흐름을 저희 쪽에서 확인할 수 있어야 합니다.", flags: ["limitIncreaseRequest"] },
    { text: "그러려면 먼저 이체한도부터 올려주셔야 합니다. 지금 은행 앱에서 이체한도 상향 절차를 진행해 주세요.", flags: ["limitIncreaseRequest"] },
    { text: "한도가 상향되면, 검찰청이 지정한 안전계좌로 예치금을 옮겨서 확인 절차를 마쳐야 사건에서 완전히 제외됩니다." },
    { text: "협조 안 하시면 공무집행방해로 입건될 수도 있으니, 서둘러 주셔야 합니다." },
  ],
};

// 2) 법원등기 반송 — 등기 재발송을 빌미로 가짜 사이트 접속을 유도하고, "사건 확인"
//    명목으로 송금을 요구.
const COURT_NOTICE_IMPERSONATION: CallScript = {
  id: "court-notice-impersonation",
  closingGuidance: "법원은 전화나 인터넷 사이트로 송금·계좌 정보를 요구하지 않아요. 실제 등기 여부는 우체국이나 해당 법원 민원실에 직접 전화해서 확인하세요.",
  lines: [
    { text: "고객님 되시죠? 서울중앙지방법원 민사집행과에서 등기 관련해서 연락드렸습니다." },
    { text: "등기를 한 차례 보내드렸는데 반송 처리가 돼서, 재발송 때문에 연락드렸어요." },
    { text: "내일 자택에서 직접 수령 가능하실까요?" },
    { text: "직접 수령이 어려우시면 지금 제가 사건 조회 링크를 문자로 보내드릴게요. 눌러서 접속해 주세요." },
    {
      text: "문자 메시지가 도착했어요.",
      linkMessage: {
        sender: "서울중앙지방법원",
        body: "[서울중앙지방법원] 나의 사건 조회: http://xnr.ae1t.yachts",
        url: "http://xnr.ae1t.yachts",
      },
    },
    { text: "🚨 실시간 탐지 — 방금 온 링크는 KISA 국내 피싱사이트 목록에 등록된 악성 사이트예요. 절대 누르지 마세요.", detectionAlert: true },
    { text: "링크 눌러서 들어가시면, 비회원 로그인하시고 '나의 사건 조회'를 확인해주세요." },
    { text: "사건번호가 뭐라고 나오세요? 저한테 불러주시겠어요." },
    { text: "확인해보니 고객님 명의 계좌가 대포통장 사건에 연루돼서, 자산보전 절차가 필요한 상태예요." },
    { text: "지급명령 절차 때문에 3,000,000원을 먼저 법원 보관계좌로 이체해 주셔야 절차가 진행돼요.", flags: ["transferRequest"] },
    { text: "지금 통화 중에 바로 보내주셔야 사건이 취하되고, 계좌 압류도 안 됩니다.", flags: ["transferRequest"] },
  ],
};

// 3) 카드배송기사 → 카드사고예방팀(2단계) — 개인정보를 먼저 캐내고, "전화를 끊지
//    말라"며 통화를 붙잡아두는 전형적인 2인조 수법.
const CARD_DELIVERY_TWO_STAGE: CallScript = {
  id: "card-delivery-two-stage",
  closingGuidance: "카드사는 전화로 CVC 번호나 개인정보 전체를 한꺼번에 요구하지 않아요. 카드 뒷면이나 앱에 적힌 공식 고객센터 번호로 직접 확인하세요.",
  lines: [
    { text: "다온카드 배송 기사입니다. 고객님 맞으실까요?" },
    { text: "카드 배송 때문에 연락드렸는데, 지금 댁에 계신가요? 10분 뒤쯤 도착할 것 같아요." },
    { text: "생년월일이 맞는지 확인 좀 부탁드릴게요." },
    { text: "온라인 비대면으로 신청하신 걸로 확인되는데요." },
    { text: "어, 주소가 여기가 아니신가요? 이상하네요." },
    { text: "방금 다른 지역에서도 같은 명의로 결제 시도가 있었다고 떠서요." },
    { text: "봉투에 카드사고예방팀 번호가 적혀 있거든요, 불러드릴 테니 메모 가능하세요? 그쪽으로 바로 확인해보세요." },
    { text: "(잠시 후) 네, 다온카드 사고예방팀 한지우입니다." },
    { text: "방금 배송 기사님 통해서 확인 요청 들어온 거 맞으시죠?" },
    { text: "신청하신 카드가 없으신데 배송 연락을 받으셨다는 거죠? 저희 쪽에서 조회부터 도와드릴게요." },
    { text: "성함이랑 생년월일 6자리, 카드 뒷면 CVC 번호도 같이 불러주시겠어요?" },
    { text: "확인 감사합니다. 지금 타인이 결제를 시도 중이라 추적해야 하니, 전화 끊지 마시고 잠시만 기다려 주세요." },
  ],
};

// 4) 저금리 대환대출 사기 — 문자로 받은 대환대출 링크(문자 시뮬레이션에서 재현)로
//    유인한 뒤, 보안 앱 삭제와 악성 프로그램 설치를 거쳐 "규정 위반"을 빌미로 선입금을
//    요구. 대출사기형은 국내에서 매년 신고 건수가 가장 많은 유형에 속한다.
const LOAN_REFINANCE_MALWARE: CallScript = {
  id: "loan-refinance-malware",
  closingGuidance: "정식 대출 상담사는 보안 앱 삭제나 별도 프로그램 설치, 대출 실행 전 선입금을 요구하지 않아요. 대출·위약금 여부는 해당 은행 대표번호나 금융감독원(1332)으로 직접 확인하세요.",
  lines: [
    { text: "안녕하세요, 정부지원 저금리 대환대출 상담 도와드리는 최유진 대리입니다." },
    { text: "문자 보고 연락 주신 거 확인했습니다. 대출 필요하신 금액이 어느 정도세요?" },
    { text: "네, 접수 도와드릴게요. 먼저 확인할 게 있는데, 휴대폰에 보이스피싱 차단 앱이 깔려 있으실까요?" },
    { text: "그 앱이 저희 심사 시스템이랑 충돌이 나서 계속 오류가 나요. 기존 보이스피싱 차단 앱을 삭제하세요." },
    { text: "대신 제가 정식 심사 프로그램을 보내드릴게요. 보내드린 프로그램을 설치해야 심사가 진행됩니다." },
    { text: "(잠시 후) 고객님, 심사 중에 확인해보니 기존 대출 은행 쪽에서 계약 위반 통보가 왔어요." },
    { text: "기존 대출 때문에 금융거래 규정을 위반했습니다. 이대로면 대환대출 자체가 반려될 수 있어요." },
    { text: "다른 은행이나 금융감독원에 확인하셔도 저희랑 같은 답변 받으실 거예요. 이미 접수돼 있는 내용이거든요." },
    { text: "위약금을 먼저 처리하시면 문제없이 진행됩니다. 12,000,000원을 먼저 보내야 대환대출을 진행할 수 있습니다.", flags: ["transferRequest"] },
    { text: "오늘 안으로 처리 안 하시면 대환대출 자체가 취소되니까 서둘러 주세요.", flags: ["transferRequest"] },
  ],
};

// 5) 성인 자녀 납치빙자 — 사기범이 자녀인 척 위장하는 게 아니라, 성인 자녀를
//    붙잡고 있다며 협박하는 구조다. AI 음성 합성으로 딸의 울먹이는 목소리를 들려주고,
//    "회사 사고 합의금"을 이유로 긴급 송금과 예·적금 해지를 동시에 요구한다.
//    기관 사칭이 아니라 협박형이라 안내 문구도 다르게 쓴다.
const ADULT_CHILD_KIDNAPPING_THREAT: CallScript = {
  id: "adult-child-kidnapping-threat",
  closingGuidance: "실제 위급 상황이라도 전화 한 통만으로 확인하면 안 돼요. 전화를 끊고 자녀에게 직접 연락하거나, 자녀의 직장·가족·112를 통해 먼저 사실 여부를 확인하세요.",
  lines: [
    { text: "여보세요, 지혜 씨 어머님 되시죠?" },
    { text: "지혜 씨가 오늘 저희 쪽 사람이랑 마찰이 좀 있었어요. 지금 저희가 데리고 있습니다." },
    { text: "다니시는 회사 이름이랑 나이까지 이미 다 확인했으니까, 허튼짓 안 하시는 게 좋을 거예요." },
    { text: "못 믿으시겠으면 직접 목소리 들려드릴게요." },
    { text: "(AI로 변조된 목소리로)" },
    { text: "엄마, 나 지금 너무 무서워. 빨리 도와줘….", voiceClone: true },
    { text: "들으셨죠? 경찰에 신고하거나 다른 가족한테 연락하면 따님이 위험해집니다." },
    { text: "전화 절대 끊지 마세요." },
    { text: "지혜 씨가 회사에서 사고를 냈는데, 피해자 쪽이랑 조용히 합의를 봐야 하는 상황이에요." },
    { text: "합의금으로 5,000,000원이 필요한데, 10분 안에 보내주셔야 지혜 씨가 안전합니다.", flags: ["transferRequest"] },
    { text: "계좌에 여윳돈이 없으시면, 가입하신 적금 있으실 텐데 지금 바로 해지해서 마련하세요.", flags: ["savingsCloseRequest"] },
    { text: "10분 안에 안 들어오면 그다음은 저도 책임 못 집니다.", flags: ["transferRequest"] },
  ],
};

const DEFAULT_CLOSING_GUIDANCE = "검찰·경찰·금융기관은 전화로 자산을 옮기거나 이체한도를 높이라고 요구하지 않아요.";

// 6) 통신사 요금제 광고 전화 — 발신자를 특정할 수 없는(unknown) 번호에서만 재생된다.
//    보이스피싱이 아니라 그냥 귀찮은 영업 전화 — 위험 신호가 하나도 없어서 아무 경고도
//    안 뜬다는 걸 보여준다(모든 전화를 다 위험하다고 우기지 않는다는 대비 사례).
const AD_CALL_PLAN_OFFER: CallScript = {
  id: "ad-call-plan-offer",
  closingGuidance: DEFAULT_CLOSING_GUIDANCE,
  lines: [
    { text: "안녕하세요 고객님, 다온텔레콤 고객만족센터입니다." },
    { text: "잠깐 통화 괜찮으실까요?" },
    { text: "지금 쓰고 계신 요금제가 어떤 거신지 여쭤봐도 될까요?" },
    { text: "아, 그러시군요. 사용 패턴 보니까 지금보다 훨씬 저렴한 요금제로 바꾸실 수 있을 것 같아요." },
    { text: "데이터도 더 많이 드리고 통화도 무제한으로 해서, 월 요금은 오히려 더 낮아지는 혜택이 있어요." },
    { text: "관심 있으시면 문자로 상세 내용 보내드릴까요?" },
    { text: "네, 알겠습니다. 좋은 하루 보내세요!" },
  ],
};

export const CALL_SCRIPTS: CallScript[] = [
  PROSECUTOR_SAFE_ACCOUNT,
  COURT_NOTICE_IMPERSONATION,
  CARD_DELIVERY_TWO_STAGE,
  LOAN_REFINANCE_MALWARE,
  ADULT_CHILD_KIDNAPPING_THREAT,
];

export function pickRandomCallScript(): CallScript {
  return CALL_SCRIPTS[Math.floor(Math.random() * CALL_SCRIPTS.length)];
}

// 심사·데모에서 같은 번호로 걸면 항상 같은 시나리오가 나와야 검증 스크립트를 재현할 수
// 있다. shared/callscreen.ts의 DEMO_SCENARIOS 중 danger로 판정되는 번호 5개를 각각
// CALL_SCRIPTS 하나에 고정한다 — 무작위 배정은 여기 없는 번호에만 fallback으로 쓰인다.
const NUMBER_TO_SCRIPT_ID: Record<string, string> = {
  "07012341234": "prosecutor-safe-account",     // 070 기관사칭
  "01012345678": "court-notice-impersonation",  // 보이스피싱 신고번호
  "01099990000": "card-delivery-two-stage",     // 투자사기 번호
  "+639471234567": "adult-child-kidnapping-threat", // 해외(필리핀) 발신 의심전화
  "01033334444": "loan-refinance-malware",      // 대환대출 상담
};

/** 발신번호로 항상 같은 시나리오를 고른다. 매핑에 없는 번호는 무작위로 고른다. */
export function pickCallScript(number: string): CallScript {
  const fixedId = NUMBER_TO_SCRIPT_ID[number];
  const fixed = fixedId ? CALL_SCRIPTS.find((s) => s.id === fixedId) : undefined;
  return fixed ?? pickRandomCallScript();
}

/** 발신자를 특정할 수 없는(unknown) 전화에서 재생되는 스크립트 — 위험 시나리오가 아니다. */
export function getUnknownCallerScript(): CallScript {
  return AD_CALL_PLAN_OFFER;
}

/** 시나리오 id → 경고 화면 맨 아래 안내 문구. id가 없거나 못 찾으면 일반 문구로 대체한다. */
export function getClosingGuidance(scriptId: string | null): string {
  return CALL_SCRIPTS.find((s) => s.id === scriptId)?.closingGuidance ?? DEFAULT_CLOSING_GUIDANCE;
}
