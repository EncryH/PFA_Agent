import { verifyPhoneWithNaverSearch } from "../../../backend/agents/1-counterparty-verification/agent.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    const result = await verifyPhoneWithNaverSearch(req.body?.phone, {
      enabled: process.env.NAVER_SEARCH_ENABLED,
      clientId: process.env.NAVER_API_HUB_CLIENT_ID,
      clientSecret: process.env.NAVER_API_HUB_CLIENT_SECRET,
      baseUrl: process.env.NAVER_SEARCH_BASE_URL,
      timeoutMs: process.env.NAVER_SEARCH_TIMEOUT_MS,
      kdicConfig: {
        enabled: process.env.KDIC_API_ENABLED,
        apiKey: process.env.KDIC_API_KEY,
        baseUrl: process.env.KDIC_API_URL,
        timeoutMs: process.env.KDIC_API_TIMEOUT_MS,
      },
    });
    return res.status(200).json({ result });
  } catch (error) {
    if (error.code === "INVALID_PHONE") return res.status(400).json({ error: error.message });
    console.error("[api/counterparty/phone]", error.message);
    return res.status(502).json({ error: "전화번호 공개 웹문서 검색을 완료하지 못했습니다" });
  }
}
