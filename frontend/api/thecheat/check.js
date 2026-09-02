import { matchBlacklist } from "../../../backend/agents/1-counterparty-verification/rules/blacklist.js";

export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const hit = matchBlacklist(String(req.body?.query ?? ""));
    return res.status(200).json({
      data: hit
        ? { found: true, ...hit }
        : { found: false, reportCount: 0, scamTypes: [], lastReported: "" },
    });
  } catch (error) {
    console.error("[api/thecheat/check]", error);
    return res.status(500).json({ error: error.message });
  }
}
