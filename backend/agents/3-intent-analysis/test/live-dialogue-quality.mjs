// 합성 대화로 실제 LLM의 관련성·연속성 검사. 외부 호출: --live 필수.
import assert from "node:assert/strict";
import {runIntentAnalysisAgent} from "../agent.js";
if (!process.argv.includes("--live") || !process.env.GEMINI_API_KEY) throw new Error("--live와 Gemini 설정이 필요합니다");
const u=text=>({role:"user",text});
const a=text=>({role:"ai",text});
const transfer={amount:100000,isFirstTransfer:true,forcedHold:true};
const cases=[
  {name:"개념",messages:[u("보이스피싱이 뭐예요?")],kind:"information",check:r=>{assert.match(r.message,/전화|사칭/);assert.doesNotMatch(r.message,/누가|누구의 요청/);}},
  {name:"도움",messages:[u("도와주세요")],kind:"help",check:r=>{assert.match(r.message,/어떤|무슨|말씀/);assert.doesNotMatch(r.message,/자녀분께 알려|잡아두|안심하세요/);}},
  {name:"이유",messages:[u("검찰이 안전계좌로 옮기라고 했어요"),a("기관사칭이 의심돼요. 송금을 멈추고 확인해 주세요."),u("왜 위험하다고 했어요?")],kind:"explain",check:r=>{assert.match(r.message,/안전계좌|안전 계좌/);assert.doesNotMatch(r.message,/누구의 요청|누가.*보내/);}},
  {name:"쉽게 한 줄",messages:[a("수사기관을 사칭해 자금 이체를 요구하는 기망 행위가 의심됩니다."),u("무슨 말인지 모르겠어요. 한 줄로 쉽게 말해줘요")],kind:"simplify",check:r=>{assert.ok(r.message.length<160);assert.doesNotMatch(r.message,/기망|누가.*보내/);}},
  {name:"피해 후 개념",messages:[u("돈을 이미 보냈어요"),a("은행에 지급정지를 요청해 주세요."),u("지급정지가 뭐예요?")],kind:"information",check:r=>{assert.match(r.message,/인출|출금|빠져|뽑아|찾아가지|이체/);assert.doesNotMatch(r.message,/지금은 송금하지|상대방은 사기꾼/);assert.equal(r.middleware.action,"damage_response");}},
  {name:"실행 질문",messages:[u("가족에게 확인을 요청하면 뭐가 달라져요?")],kind:"information",check:r=>{assert.equal(r.middleware.action,null);assert.doesNotMatch(r.message,/요청을 보냈|알려드릴게요/);}},
  {name:"애매한 이유 질문",messages:[u("검찰이 안전계좌로 보내래요"),a("기관사칭이 의심돼요."),u("그 판단의 까닭이 궁금하네요")],kind:"explain",check:r=>assert.match(r.message,/검찰|안전계좌|안전 계좌/)},
];
let failed=0;
for (const c of cases) {
  try {
    const r=await runIntentAnalysisAgent({transfer,messages:c.messages,turn:5,conversationState:{resumed:c.messages.length>1,analysisDone:true,analysisHold:true}}, {apiKey:process.env.GEMINI_API_KEY});
    assert.equal(r.fallback,false);
    assert.equal(r.middleware.dialogueKind,c.kind);
    assert.equal(r.hold,true); assert.equal(r.done,false);
    c.check(r);
    assert.doesNotMatch(r.message,/\babsolute\b|거짓말이니/);
    console.log(JSON.stringify({scenario:c.name,route:r.middleware.route,kind:r.middleware.dialogueKind,message:r.message}));
  } catch(e) {failed++;console.log(JSON.stringify({scenario:c.name,error:e.message}));}
}
process.exitCode=failed?1:0;
