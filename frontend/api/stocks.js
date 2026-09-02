import { fetchStockQuotes } from "../../backend/stocks.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  const raw = Array.isArray(req.query.symbols) ? req.query.symbols.join(",") : String(req.query.symbols ?? "");
  const symbols = raw.split(",").map((symbol) => symbol.trim()).filter(Boolean);
  if (!symbols.length) return res.status(400).json({ error: "symbols query param required" });

  try {
    return res.status(200).json(await fetchStockQuotes(symbols));
  } catch (error) {
    console.error("[api/stocks]", error);
    return res.status(502).json({ error: error.message });
  }
}
