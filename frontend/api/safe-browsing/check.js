import { checkUrlThreat } from "../../../backend/safebrowsing.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const target = String(req.body?.url ?? "").trim();
  if (!target) return res.status(400).json({ error: "url required" });

  try {
    const result = await checkUrlThreat(target, process.env.GOOGLE_SAFE_BROWSING_API_KEY);
    return res.status(200).json({ result });
  } catch (error) {
    console.error("[api/safe-browsing/check]", error);
    return res.status(502).json({ error: error.message });
  }
}
