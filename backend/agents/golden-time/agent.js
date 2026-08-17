import { AGENT_STATUS } from "../shared.js";

export const metadata = Object.freeze({
  layer: 6,
  key: "golden-time",
  name: "골든타임 사후 대응",
  status: AGENT_STATUS.READY,
});

const ACTIONS = Object.freeze([
  { order: 1, key: "CALL_BANK", title: "은행에 지급정지를 요청하세요", channel: "은행 공식 앱·대표번호" },
  { order: 2, key: "REPORT_POLICE", title: "112에 피해 사실을 신고하세요", channel: "경찰 112" },
  { order: 3, key: "START_RELIEF", title: "피해구제 절차를 신청하세요", channel: "송금 은행 영업점·공식 고객센터" },
  { order: 4, key: "PRESERVE_EVIDENCE", title: "통화·문자·송금 자료를 보관하세요", channel: "기기 내 증거 보관" },
]);

// 실제 지급정지나 신고를 대신 실행하지 않고, 사용자가 즉시 수행할 순서를 반환한다.
export function runGoldenTimeAgent({ transferId = "", sentAt = "", amount = 0, recipient = "" } = {}) {
  return {
    agent: metadata.key,
    decision: "START_GOLDEN_TIME_RESPONSE",
    incident: { transferId, sentAt, amount, recipient },
    actions: ACTIONS,
    automaticExecution: false,
    requiresUserAction: true,
  };
}
