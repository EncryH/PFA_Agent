import { checkUrlThreat } from "../../../backend/safebrowsing.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  const target = Array.isArray(req.query.url) ? req.query.url[0] : String(req.query.url ?? "");
  if (!target) return res.status(400).json({ error: "url query param required" });

  try {
    const result = await checkUrlThreat(target, process.env.GOOGLE_SAFE_BROWSING_API_KEY);
    return res.status(200).json({ result });
  } catch (error) {
    console.error("[api/safe-browsing/check]", error);
    return res.status(502).json({ error: error.message });
  }
}
