// 합성 시나리오만 전송한다. 실행: node --env-file=.env .../live-conversation-quality.mjs --live
import assert from "node:assert/strict";
import { runIntentAnalysisAgent } from "../agent.js";
if (!process.argv.includes("--live")) throw new Error("외부 LLM을 호출하려면 --live를 지정하세요");
if (!process.env.GEMINI_API_KEY) throw new Error("Gemini 설정이 없습니다");
const user = text => ({role:"user",text});
const ai = text => ({role:"ai",text});
const transfer = {amount:12000000, recipientName:"가상수취인", bank:"가상은행", isFirstTransfer:true};
const options = {apiKey:process.env.GEMINI_API_KEY};
const scenarios = [
  {name:"송금 완료", messages:[ai("은행을 사칭한 선입금 요구가 의심돼요."),user("돈을 이미 보냈어요")], check:r=>{assert.equal(r.action,"damage_response");assert.match(r.message,/지급정지/);assert.doesNotMatch(r.message,/지금은 송금하지|보내려/);}},
  {name:"인증정보만 노출",messages:[user("돈은 안 보냈지만 인증번호는 알려줬어요")],check:r=>{assert.equal(r.situation.facts.transfer.status,"no");assert.equal(r.situation.facts.credential.status,"yes");assert.doesNotMatch(r.message,/이미 송금|이미 보내셨/);}},
  {name:"링크 클릭만",messages:[user("문자로 온 링크를 눌렀어요")],check:r=>{assert.equal(r.situation.facts.link.status,"yes");assert.doesNotMatch(r.message,/정보를 이미 전달|정보가 유출됐어요|안심하세요/);}},
  {name:"가정 질문",messages:[user("돈을 보냈으면 어떻게 하나요?")],check:r=>{assert.notEqual(r.situation.facts.transfer?.status,"yes");assert.notEqual(r.action,"damage_response");assert.doesNotMatch(r.message,/182/);assert.match(r.message,/112/);}},
  {name:"정상 거래",messages:[user("평소 보내던 딸 계좌로 생활비를 보내요. 제가 먼저 보내는 거예요.")],transfer:{...transfer,amount:100000,isFirstTransfer:false},check:r=>{assert.equal(r.hold,false);assert.notEqual(r.action,"damage_response");}},
];
let failures = 0;
for (const scenario of scenarios) {
  try {
    const r = await runIntentAnalysisAgent({transfer:scenario.transfer || transfer,messages:scenario.messages,turn:4},options);
    scenario.check(r);
    assert.equal(r.fallback,false); assert.notEqual(r.responseFallback,true);
    console.log(JSON.stringify({scenario:scenario.name,message:r.message,fallback:r.fallback,responseFallback:r.responseFallback}));
    if (scenario.name === "송금 완료") {
      const resumed = JSON.parse(JSON.stringify({resumed:true,analysisDone:true,analysisHold:true,situation:r.situation}));
      const history = [...scenario.messages, ai(r.message), user("은행에 지급정지를 요청했고 경찰에 신고했어요. 다음에는 뭘 해야 해요?")];
      const next = await runIntentAnalysisAgent({transfer,messages:history,turn:5,conversationState:resumed},options);
      assert.equal(next.situation.facts.freeze_request.status,"yes");
      assert.equal(next.situation.facts.police_report.status,"yes");
      assert.doesNotMatch(next.message,/112에 (?:즉시 )?(?:피해 사실을 )?신고해/);
      assert.equal(next.fallback,false);assert.notEqual(next.responseFallback,true);
      console.log(JSON.stringify({scenario:"저장·재개 후 이미 완료한 조치",message:next.message}));
    }
  } catch(e) { failures++;console.log(JSON.stringify({scenario:scenario.name,error:e.message})); }
}
process.exitCode = failures ? 1 : 0;
