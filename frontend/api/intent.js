import postgres from "postgres";

import { runIntentAnalysisAgent } from "../../backend/agents/3-intent-analysis/agent.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

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
        // backend/ 는 frontend/node_modules 를 resolve 할 수 없다. 패키지를 찾을 수
        // 있는 이쪽에서 팩토리를 넘겨준다 (backend/text2sql/client.js 주석 참고).
        postgresFactory: postgres,
      },
    });
    return res.status(200).json(result);
  } catch (error) {
    console.error("[api/intent]", error);
    return res.status(502).json({ error: "송금 의도 분석을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요." });
  }
}
