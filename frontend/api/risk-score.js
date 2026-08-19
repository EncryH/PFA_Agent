// Vercel 서버리스 함수 — POST /api/risk-score
// dev 서버(vite.config.ts의 riskScoreApi)와 로직을 backend/agents/orchestrator.js 에서 함께 쓴다.

import { scoreTransferRisk } from "../../backend/agents/orchestrator.js";

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }
  try {
    const result = scoreTransferRisk(req.body ?? {});
    res.status(200).json(result);
  } catch (e) {
    console.error("[api/risk-score]", e);
    res.status(502).json({ error: e.message });
  }
}
