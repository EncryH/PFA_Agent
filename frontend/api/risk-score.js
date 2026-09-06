import { scoreRisk } from "../../backend/risk.js";

export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    return res.status(200).json(scoreRisk(req.body ?? {}));
  } catch (error) {
    console.error("[api/risk-score]", error);
    return res.status(502).json({ error: "위험도 계산을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요." });
  }
}
