import { resolveSituation, needsDamageResponse } from "../../../shared/conversation-state.js";

export function isEmergencySelfReport(text = "") {
  return needsDamageResponse(resolveSituation([{ role: "user", text }]));
}
export function hasCompromiseStatusAnswer(text = "") {
  const state = resolveSituation([{ role: "user", text }]);
  return needsDamageResponse(state) || Object.keys(state.facts).length > 0;
}
