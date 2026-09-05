import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { resolveSituation, needsDamageResponse } from "../../../../shared/conversation-state.js";
import { damageResponsePlan } from "../response-plan.js";
import { generateUserResponse, validateUserResponse } from "../llm/gemini.js";
import { runIntentAnalysisAgent } from "../agent.js";
import { routeIntentRequest } from "../middleware/index.js";
import { validateContactAdvice } from "../middleware/response-contract.js";
const user = text => ({ role: "user", text });
const ai = text => ({ role: "ai", text });

test("긴급 신고 번호 오류와 확인되지 않은 안심 표현을 거부한다", () => {
  assert.throws(() => validateContactAdvice("경찰청 182에 피해 사실을 신고하세요."), /112/);
  const plan = damageResponsePlan(resolveSituation([user("링크를 눌렀어요")]));
  assert.throws(() => validateUserResponse("링크만 눌렀다면 안심하세요. 이제 그 창을 닫으면 돼요.", "damage", plan), /안전을 보장/);
});

test("가정·부정·실행을 구분하고 송금 부정과 인증정보 노출을 각각 반영한다", () => {
  assert.equal(needsDamageResponse(resolveSituation([user("돈을 보냈으면 어떻게 하나요?")])), false);
  const mixed = resolveSituation([user("돈은 안 보냈지만 인증번호는 알려줬어요")]);
  assert.equal(mixed.facts.transfer.status, "no");
  assert.equal(mixed.facts.credential.status, "yes");
  assert.equal(needsDamageResponse(mixed), true);
});

test("짧은 답변은 직전 실행 여부 질문과 연결하고 다른 질문의 네는 피해로 해석하지 않는다", () => {
  assert.equal(resolveSituation([ai("돈을 이미 보내셨나요?"), user("보냈어요")]).facts.transfer.status, "yes");
  assert.equal(needsDamageResponse(resolveSituation([ai("설명을 들으시겠어요?"), user("네")])), false);
});

test("링크 클릭은 정보 제공과 구분하고 필요한 후속 질문을 선택한다", () => {
  const state = resolveSituation([user("링크를 눌렀어요")]);
  assert.equal(state.facts.personal, undefined);
  const plan = damageResponsePlan(state);
  assert.match(plan.question, /설치하거나/);
  assert.doesNotMatch(plan.fallback, /정보를 이미 전달/);
});

test("은행 연락과 지급정지 요청을 구분하고 완료한 신고를 처음부터 반복하지 않는다", () => {
  let state = resolveSituation([user("돈을 이미 보냈어요"), user("은행에 전화했어요")]);
  assert.equal(state.facts.freeze_request, undefined);
  assert.match(damageResponsePlan(state).fallback, /지급정지를 요청/);
  state = resolveSituation([user("은행에 지급정지를 요청했어요"), user("경찰에 신고했어요")], state);
  const plan = damageResponsePlan(state);
  assert.doesNotMatch(plan.fallback, /112에 피해를 신고하세요/);
  assert.match(plan.fallback, /실제 접수·처리됐는지/);
});

test("상태를 저장해 재개한 뒤 최신 정정을 반영하고 LLM의 근거 없는 사실을 거부한다", () => {
  const stored = JSON.parse(JSON.stringify(resolveSituation([user("돈을 보냈어요")])));
  assert.equal(resolveSituation([user("아니요 돈은 안 보냈어요")], stored).facts.transfer.status, "no");
  assert.equal(resolveSituation([user("궁금해요")], {}, [{key:"transfer",status:"yes",evidence:"돈을 보냈어요"}]).facts.transfer, undefined);
  const semantic = resolveSituation([user("상대에게 오십만 원을 건넸어요")], {}, [{key:"transfer",status:"yes",evidence:"오십만 원을 건넸어요"}]);
  assert.equal(semantic.facts.transfer.status, "yes");
});

test("문장 일부를 삭제하지 않고 재작성을 요구하며 기관명은 허용한다", () => {
  assert.throws(() => validateUserResponse("평소와 다른 패턴이라서 확인이 필요해요. 누가 요청하셨나요?", "probe"), /다시 작성/);
  const text = "금융보안원이라고 연락받으셨군요. 어떤 요구를 했나요?";
  assert.equal(validateUserResponse(text, "probe"), text);
});

test("피해 상태와 모순되는 안내를 거부하고 한 가지 행동만 있는 답변도 허용한다", () => {
  const plan = damageResponsePlan(resolveSituation([user("돈을 이미 보냈어요")]));
  assert.throws(() => validateUserResponse("지금은 송금하지 말고 상대방에게 연락해 확인해 주세요.", "damage", plan), /송금 전/);
  const text = "이미 보내셨군요. 은행 공식 고객센터에 즉시 연락해 지급정지를 요청해 주세요.";
  assert.equal(validateUserResponse(text, "damage", plan), text);
});

test("피해 후속 질문도 상태를 유지해 전체 분석 경로로 전달한다", async () => {
  const state = resolveSituation([user("돈을 이미 보냈어요")]);
  const routed = await routeIntentRequest({messages:[user("지급정지가 뭐예요?")], conversationState:{situation:state}});
  assert.equal(routed.handled, false);
  assert.equal(routed.middleware.emergency, true);
});

test("LLM 장애에서도 이미 송금한 사실과 피해대응 연결을 보존한다", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("test offline"); };
  try {
    const result = await runIntentAnalysisAgent({ transfer:{amount:100000}, messages:[user("돈을 이미 보냈어요")], turn:1 }, {apiKey:"test-key"});
    assert.equal(result.action, "damage_response");
    assert.equal(result.fallback, true);
    assert.match(result.message, /지급정지/);
    assert.doesNotMatch(result.message, /지금은 송금하지|누가 돈을/);
  } finally { globalThis.fetch = original; }
});

test("잘못된 LLM 답변은 사유를 전달해 다시 생성하고 블록 순서를 보존한다", async () => {
  const original = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (_url, options) => {
    requests.push(JSON.parse(options.body));
    const text = requests.length === 1
      ? "지금은 송금하지 말고 상대방과의 연락을 멈추세요."
      : "이미 보내셨군요. 은행 공식 고객센터에 즉시 연락해 지급정지를 요청해 주세요.";
    const blocks = [{kind:"paragraph",text}];
    if (requests.length > 1) blocks.push({kind:"action",text:"1. 송금 내역과 상대방의 메시지를 보관해 주세요."});
    return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({blocks})}]}}]}));
  };
  try {
    const plan = damageResponsePlan(resolveSituation([user("돈을 이미 보냈어요")]));
    const message = await generateUserResponse({mode:"damage",responsePlan:plan}, "test-key");
    assert.equal(requests.length, 2);
    assert.match(requests[1].contents[0].parts[0].text, /이미 송금한 상황/);
    assert.match(message, /^이미 보내셨군요/);
    assert.match(message, /\n\n1\. 송금 내역/);
    assert.doesNotMatch(message, /1\. 1\./);
  } finally {globalThis.fetch = original;}
});

test("화면·음성 표시와 상담 저장은 피해대응 본문과 상태를 손실 없이 보존한다", () => {
  const require = createRequire(new URL("../../../../frontend/package.json", import.meta.url));
  const ts = require("typescript");
  const load = (relative, extras = {}) => {
    const code = readFileSync(new URL(relative, import.meta.url), "utf8");
    const js = ts.transpileModule(code, {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
    const context = {exports:{},require,...extras}; vm.runInNewContext(js,context); return context.exports;
  };
  const renderer = load("../../../../frontend/src/shared/ReadableAiMessage.tsx");
  const text = "이미 송금하신 상황이에요.\n\n지금 바로 이렇게 대응해 주세요\n\n1. 은행에 연락해 주세요.\n\n요청한 뒤에는 처리 여부를 확인해 주세요.";
  assert.equal(renderer.formatReadableAiMessage(text), text);
  assert.equal(renderer.formatAiSpeechText(text), text);
  const cache = new Map();
  const storage = load("../../../../frontend/src/shared/intentChat.ts", {localStorage:{getItem:k=>cache.get(k),setItem:(k,v)=>cache.set(k,v)},window:{dispatchEvent:()=>{}},Event:class {}});
  const session = {schemaVersion:1,id:"test",updatedAt:new Date().toISOString(),messages:[user("돈을 보냈어요"),{...ai(text),action:"damage_response"}],situation:resolveSituation([user("돈을 보냈어요")])};
  storage.saveIntentChatSession(session);
  const restored = storage.readIntentChatSession("test");
  assert.equal(restored.messages[1].text, text);
  assert.equal(restored.messages[1].action, "damage_response");
  assert.equal(restored.situation.facts.transfer.status, "yes");
});
