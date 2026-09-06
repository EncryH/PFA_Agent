// 필요한 행동과 우선순위는 서버가 선택하고, LLM은 대화에 맞는 표현을 작성한다.
// 지급정지·112 대응 근거: https://fsc.go.kr/po010101/83034 (금융위원회)
export function damageResponsePlan(state, latest = "") {
  const yes = (key) => state.facts?.[key]?.status === "yes";
  const actions = [];
  let summary = "피해가 의심되는 상황을 말씀해 주셨어요.";
  if (yes("transfer")) {
    summary = "이미 돈을 보내셨다고 말씀해 주셨어요.";
    if (!yes("freeze_request")) actions.push("송금에 이용한 금융회사 공식 고객센터에 피해 사실을 알리고 지급정지를 요청하세요.");
    else actions.push("지급정지를 요청하셨군요. 은행에서 실제 접수·처리됐는지 확인하고 안내받은 후속 서류를 준비하세요.");
    if (!yes("police_report")) actions.push("경찰 112에 피해를 신고하세요. 송금 시각·금액·수취계좌를 확인할 수 있도록 준비해 주세요.");
    else actions.push("경찰에 신고한 접수정보를 보관하고 안내받은 절차를 이어가세요.");
  }
  if (yes("app")) {
    actions.push("의심 앱을 설치한 휴대폰 사용을 멈추고 다른 안전한 전화로 금융회사 또는 112에 연락하세요.");
  }
  if (yes("credential") || yes("personal")) {
    summary = yes("transfer") ? summary : "정보를 이미 전달하셨다고 말씀해 주셨어요.";
    actions.push("금융회사 공식 고객센터에 어떤 정보가 노출됐는지 알리고 보호 조치를 요청하세요.");
    if (yes("credential")) actions.push("알려준 비밀번호·인증수단은 안전한 기기에서 변경하거나 재발급받도록 금융회사에 문의하세요.");
  }
  let question = "";
  if (yes("link") && !yes("app") && !yes("credential") && !yes("personal")) {
    summary = "링크를 누르셨다고 말씀해 주셨어요. 클릭만으로 정보가 유출됐다고 단정할 수는 없어요.";
    actions.push("해당 페이지에 정보를 더 입력하지 마세요.");
    question = "링크를 누른 뒤 앱을 설치하거나 개인정보·인증번호를 입력하셨나요?";
  } else if (!yes("transfer") && !yes("app") && !yes("personal") && !yes("credential")) {
    question = "이미 돈을 보내셨거나 상대방에게 정보를 알려주신 일이 있나요?";
  }
  if (actions.length) actions.push("통화·문자·송금내역 등 관련 자료는 삭제하지 말고 보관하세요.");
  const explanationQuestion = /뭐|무엇|뜻|왜|어떻게|방법/.test(latest);
  return {
    mode: "damage", situation: state, actions, question,
    instruction: explanationQuestion
      ? "현재 질문의 뜻·이유·방법부터 답하세요. 이전 행동 목록 전체를 반복하지 말고 관련된 다음 행동만 연결하세요."
      : "방금 새로 확인한 사실에 반응하고 지금 필요한 조치를 우선 안내하세요. 이미 한 조치를 처음부터 다시 하라고 하지 마세요.",
    fallback: [summary, ...actions.map((a, i) => `${i + 1}. ${a}`), question].filter(Boolean).join("\n\n"),
  };
}

// 위험 판정이 끝난 뒤 사용자가 "지금 뭘 해야 하나요?"라고 물었을 때 쓰는
// 서버 선택 행동이다. 확인되지 않은 앱 설치·정보 노출 같은 상태를 LLM이
// 추측하지 못하도록, 저장된 판정과 실제 대화 상태만으로 항목을 구성한다.
export function postVerdictActionPlan(conversationState = {}) {
  const situation = conversationState.situation || { facts: {} };
  const facts = situation.facts || {};
  const context = [
    conversationState.fraudTypeLabel,
    ...(Array.isArray(conversationState.riskLabels) ? conversationState.riskLabels : []),
  ].filter(Boolean).join(" ");
  const institutionImpersonation = /기관|검찰|경찰|금감원|금융감독원|안전\s*계좌/.test(context);
  const appInstalled = facts.app?.status === "yes";
  const appRequested = /앱|어플|원격\s*제어|프로그램\s*설치/.test(context);

  const actions = [
    "송금하지 말고 상대방과의 연락을 끊으세요.",
    institutionImpersonation
      ? "상대방이 알려준 번호가 아닌 해당 기관의 공식 대표번호로 사실을 확인하세요."
      : "상대방이 알려준 연락처가 아닌 금융회사·기관의 공식 번호로 사실을 확인하세요.",
  ];

  if (appInstalled) {
    actions.push("앱을 설치한 휴대폰 사용을 멈추고, 다른 안전한 전화로 금융회사 또는 경찰 112에 연락하세요.");
  } else if (appRequested) {
    actions.push("상대방이 요구한 앱이나 프로그램은 설치하지 마세요.");
  }

  actions.push("통화·문자·전화번호·계좌번호는 삭제하지 말고 보관하세요.");
  actions.push("계속 불안하거나 신고가 필요하면 경찰 112 또는 금융감독원 1332에 연락하세요.");

  return {
    presentation: "structured_actions",
    heading: "지금 해야 할 일이에요",
    actions,
    situation,
    fallback: ["지금 해야 할 일이에요", ...actions.map((action, index) => `${index + 1}. ${action}`)].join("\n\n"),
    instruction: "위험 분석이 완료된 뒤 다음 행동을 묻는 질문입니다. '지금 해야 할 일이에요'를 먼저 쓰고, 제공된 행동만 우선순위대로 번호를 붙여 안내하세요. 확인되지 않은 앱 설치·개인정보 노출·송금 완료를 추측하지 마세요.",
  };
}
