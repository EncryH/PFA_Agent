import { lookupFscInstitution } from "../../../backend/fsc.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  const name = Array.isArray(req.query.name) ? req.query.name[0] : String(req.query.name ?? "");
  if (!name) return res.status(400).json({ error: "name query param required" });

  try {
    const items = await lookupFscInstitution(name, process.env.FSC_API_KEY);
    return res.status(200).json({ items });
  } catch (error) {
    console.error("[api/fsc/verify]", error);
    return res.status(502).json({ error: error.message });
  }
}
