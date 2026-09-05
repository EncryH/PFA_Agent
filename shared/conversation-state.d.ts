export type Situation = { facts: Partial<Record<"transfer" | "link" | "app" | "personal" | "credential" | "bank_contact" | "freeze_request" | "police_report", { status: "yes" | "no"; evidence: string }>>; reportedDamage: boolean };
export function normalizeSituation(value?: unknown): Situation;
export function resolveSituation(messages?: {role: string; text: string}[], previous?: Situation, extractedFacts?: unknown[]): Situation;
export function needsDamageResponse(state?: Situation): boolean;
export function isHypothetical(text?: string): boolean;
