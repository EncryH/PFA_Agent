// 통화 데모용 대사 스크립트 — 실제 녹취를 못 구해서(개인정보·저작권 문제), 공공기관이
// 공개한 신고 사례에 반복적으로 나오는 수법을 바탕으로 새로 쓴 대사다. 실제 인물·통화
// 원본은 없고, 등장하는 이름(세무사·상담사·카드사 등)도 전부 가상이다. 5가지 시나리오
// 중 위험(danger) 통화를 받을 때마다 하나를 무작위로 고른다.
//
// 통화 화면이 이 대사를 자막으로 한 줄씩 띄우고, 특정 줄에 달린 flags를 통해
// "이체한도를 올리라는 말이 나왔는지" / "적금을 해지하라는 말이 나왔는지" /
// "구체적인 송금 요구가 나왔는지"를 감지한다. 감지된 사실은 shared/callActivity.ts에
// 저장돼, 이체한도 상향 화면·적금 해지 화면·송금 화면에서 각각 참조한다.
//
// closingGuidance: 경고 화면 맨 아래 "이렇게 확인하세요" 문구. 시나리오마다 사칭 대상이
// 달라서(세무사/법원/카드사/대출상담사/납치범) "검찰·경찰·금융기관은..." 같은 고정
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

// 1) 세무사 사칭 — 사촌동생이 신분증·위임장으로 사업자 등록을 신청했다며 명의도용을
//    빌미로 "자금부터 안전하게 지켜야 한다"고 이체한도 상향을 유도.
const TAX_AGENT_IMPERSONATION: CallScript = {
  id: "tax-agent-impersonation",
  closingGuidance: "세무사와 세무서는 전화로 이체한도 상향이나 계좌 자금 이동을 요구하지 않아요. 상대방이 알려준 번호가 아닌 관할 세무서 대표번호로 직접 확인하세요.",
  lines: [
    { text: "여보세요, 여기 이경수 세무사입니다." },
    { text: "선생님 사촌동생분이 신분증이랑 도장을 가져오셔서, 사업자 등록을 대리인 자격으로 신청하러 오셨어요." },
    { text: "위임장이랑 신분증, 인감증명서까지 다 가져오셨는데, 확인해보니 전부 원본이 맞더라고요." },
    { text: "생년월일이랑 전화번호도 저희 쪽 서류랑 다 일치하고요." },
    { text: "혹시 어떻게 된 건지 모르시겠어요?" },
    { text: "선생님 명의로 사업자 등록이 하나 더 진행 중이라, 국세청 쪽에도 확인 요청을 넣어놨습니다." },
    { text: "이런 경우 대부분 명의가 도용돼서 대포통장 개설에 쓰이는 사례라, 계좌 자금부터 안전하게 지켜드려야 할 것 같아요.", flags: ["limitIncreaseRequest"] },
    { text: "확인을 위해서 지금 바로 이체한도부터 올려주셔야 저희 쪽에서 자금 흐름을 볼 수 있어요.", flags: ["limitIncreaseRequest"] },
    { text: "안 그러면 계좌가 먼저 지급정지될 수도 있어서, 시간이 별로 없어요." },
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

// 4) 저금리 대환대출 사기 — 카카오톡으로 받은 파일(악성앱) 설치 후, 위약금 명목으로
//    현금 인출·계좌이체를 요구.
const LOAN_REFINANCE_MALWARE: CallScript = {
  id: "loan-refinance-malware",
  closingGuidance: "정식 대출 상담사는 카카오톡 파일 설치나 위약금 현금 전달을 요구하지 않아요. 대출·위약금 여부는 해당 은행 대표번호나 금융감독원(1332)으로 직접 확인하세요.",
  lines: [
    { text: "안녕하세요, 정부지원 저금리 대환대출 상담 도와드리는 최유진 대리입니다." },
    { text: "문자 보고 연락 주신 거 확인했습니다. 대출 필요하신 금액이 어느 정도세요?" },
    { text: "네, 접수 도와드릴게요. 신청서 보내드릴 테니 카카오톡 친구 추가 한번 해주시겠어요?" },
    { text: "제가 보내드린 파일이 정식 대출 신청서예요. 열어서 안내대로 진행해주시면 됩니다." },
    { text: "(잠시 후) 고객님, 대환대출 신청이 완료됐는데 기존 대출 은행 쪽에서 계약 위반이라고 연락이 왔어요." },
    { text: "약관상 중도상환수수료에 위약금까지 더해져서 이대로면 꽤 큰 금액이 나갈 수 있어요." },
    { text: "다른 은행이나 금융감독원에 확인하셔도 저희랑 같은 답변 받으실 거예요. 이미 저희 쪽에 접수돼 있거든요." },
    { text: "위약금을 먼저 현금으로 내시면 문제없이 정리됩니다. 지금 인출해서 보내주실 수 있을까요?", flags: ["transferRequest"] },
    { text: "계좌이체보다 현금으로 직접 전달해주시는 게 기록이 안 남아서 더 안전해요.", flags: ["transferRequest"] },
    { text: "시간 끌면 신용등급에도 바로 영향 가니까, 오늘 안으로 처리해주셔야 해요." },
  ],
};

// 5) 자녀 납치빙자 — 아이 울음소리(AI 음성 합성)로 겁을 준 뒤, "합의금"을 이유로
//    적금 해지와 송금을 동시에 요구. 기관 사칭이 아니라 협박형이라 안내 문구도 다르게 쓴다.
const CHILD_KIDNAPPING_THREAT: CallScript = {
  id: "child-kidnapping-threat",
  closingGuidance: "실제 위급 상황이라도 전화 한 통만으로 확인하면 안 돼요. 전화를 끊고 자녀에게 직접 연락하거나, 학교·보호자·112에 먼저 사실 여부를 확인하세요.",
  lines: [
    { text: "민준이 엄마시죠? 울지 말고 똑바로 얘기해." },
    { text: "(AI로 합성한 것으로 추정되는 아이 목소리) 엄마… 아저씨가 나 때렸어…", voiceClone: true },
    { text: "방금 제가 길가에서 담배를 피우고 있는데, 얘가 저보고 욕을 했어요." },
    { text: "그래서 제가 너무 열받아서 애를 차에 태웠고요. 지금 골목길에 주차해놨습니다." },
    { text: "핸드폰으로 신고할 생각 하지 마세요, 바로 알 수 있으니까." },
    { text: "상세한 위치는 이따가 알려드릴 거고, 제가 전화드린 이유는 딱 한 가지예요." },
    { text: "욕을 했으면 대가를 치러야죠. 합의금이 급하게 필요하실 텐데, 가입하신 적금 있으시면 지금 바로 해지해주세요.", flags: ["savingsCloseRequest"] },
    { text: "해지하신 돈으로 5,000,000원 지금 바로 보내주셔야 애 다치는 일 없이 끝납니다.", flags: ["transferRequest"] },
    { text: "10분 안에 안 들어오면 그다음은 저도 장담 못 해요." },
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
  TAX_AGENT_IMPERSONATION,
  COURT_NOTICE_IMPERSONATION,
  CARD_DELIVERY_TWO_STAGE,
  LOAN_REFINANCE_MALWARE,
  CHILD_KIDNAPPING_THREAT,
];

export function pickRandomCallScript(): CallScript {
  return CALL_SCRIPTS[Math.floor(Math.random() * CALL_SCRIPTS.length)];
}

/** 발신자를 특정할 수 없는(unknown) 전화에서 재생되는 스크립트 — 위험 시나리오가 아니다. */
export function getUnknownCallerScript(): CallScript {
  return AD_CALL_PLAN_OFFER;
}

/** 시나리오 id → 경고 화면 맨 아래 안내 문구. id가 없거나 못 찾으면 일반 문구로 대체한다. */
export function getClosingGuidance(scriptId: string | null): string {
  return CALL_SCRIPTS.find((s) => s.id === scriptId)?.closingGuidance ?? DEFAULT_CLOSING_GUIDANCE;
}
