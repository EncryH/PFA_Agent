// Vite 개발 서버 전용 합성 상담 fixture. 실제 앱 진입점·배포 빌드에 포함하지 않는다.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import Transfer from "../src/screens/Transfer";
import { readIntentChatSession, saveIntentChatSession } from "../src/shared/intentChat";
import { resolveSituation } from "../../shared/conversation-state.js";
import "../src/index.css";

const id = "response-quality-fixture";
if (!readIntentChatSession(id)) {
  const now = new Date().toISOString();
  const messages = [
    {role:"user" as const,text:"돈을 이미 보냈어요"},
    {role:"ai" as const,text:"이미 보내셨군요. 지금은 피해를 줄이기 위한 조치가 필요해요.\n\n1. 은행 공식 고객센터에 즉시 연락해 지급정지를 요청해 주세요.\n\n2. 경찰 112에 피해를 신고해 주세요.",action:"damage_response" as const,display:"structured" as const},
  ];
  saveIntentChatSession({schemaVersion:1,id,createdAt:now,updatedAt:now,
    transfer:{account:"0000000000",bank:"가상은행",name:"가상수취인",amount:"100,000",fromIdx:0},
    messages,turnCount:4,riskLabels:["합성 피해 시나리오"],fraudTypeLabel:"대출 선입금 의심",fallback:false,
    analysisDone:true,analysisHold:true,situation:resolveSituation(messages),freezeSecsLeft:null,
  });
}
function Fixture() {
  const [open,setOpen] = useState(true);
  return <main className="mx-auto max-w-[430px] bg-white p-4">
    <p className="mb-3 text-xs text-gray-500">합성 상담 · 저장/재개/피해대응 검증</p>
    {open ? <Transfer resumeSessionId={id} onExit={()=>setOpen(false)}/> : <button onClick={()=>setOpen(true)}>저장된 테스트 상담 다시 열기</button>}
  </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
