// Vercel 서버리스 함수 — POST /api/intent
// GEMINI_API_KEY는 Vercel 프로젝트 환경변수로 등록한다 (Settings → Environment Variables).
// 브라우저 번들에는 절대 노출되지 않는다 — 이 함수는 서버에서만 실행된다.

import { runIntentAnalysisAgent } from "../../backend/agents/intent-analysis/agent.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "GEMINI_API_KEY가 설정되지 않았습니다" });
    return;
  }
  try {
    const result = await runIntentAnalysisAgent(req.body ?? {}, { apiKey });
    res.status(200).json(result);
  } catch (e) {
    console.error("[api/intent]", e);
    res.status(502).json({ error: e.message });
  }
}
