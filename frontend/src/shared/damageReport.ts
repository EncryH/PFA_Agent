import { resolveSituation, needsDamageResponse } from "../../../shared/conversation-state.js";

export function isDamageReportText(text: string): boolean {
  return needsDamageResponse(resolveSituation([{ role: "user", text }]));
}
