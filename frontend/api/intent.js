import { runIntentAnalysisAgent } from "../../backend/agents/3-intent-analysis/agent.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY가 설정되지 않았습니다" });
  }

  try {
    const result = await runIntentAnalysisAgent(req.body ?? {}, {
      apiKey: process.env.GEMINI_API_KEY,
      graphConfig: {
        enabled: process.env.NEO4J_ENABLED,
        uri: process.env.NEO4J_URI,
        username: process.env.NEO4J_USERNAME,
        password: process.env.NEO4J_PASSWORD,
        database: process.env.NEO4J_DATABASE,
        timeoutMs: process.env.NEO4J_TIMEOUT_MS,
      },
      databaseConfig: {
        enabled: process.env.TEXT2SQL_ENABLED,
        connectionString: process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL,
        timeoutMs: process.env.TEXT2SQL_TIMEOUT_MS,
      },
    });
    return res.status(200).json(result);
  } catch (error) {
    console.error("[api/intent]", error);
    return res.status(502).json({ error: error.message });
  }
}
