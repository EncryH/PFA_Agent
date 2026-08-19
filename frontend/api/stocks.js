// Vercel 서버리스 함수 — GET /api/stocks?symbols=005930.KS,^KS11,...
// Yahoo Finance 조회 로직은 backend/stocks.js — dev 서버 프록시와 공유한다.

import { fetchStockQuotes } from "../../backend/stocks.js";

export default async function handler(req, res) {
  const symbolsParam = req.query.symbols;
  const raw = Array.isArray(symbolsParam) ? symbolsParam.join(",") : (symbolsParam ?? "");
  const symbols = raw.split(",").map((s) => s.trim()).filter(Boolean);

  if (!symbols.length) {
    res.status(400).json({ error: "symbols query param required" });
    return;
  }

  try {
    const result = await fetchStockQuotes(symbols);
    res.status(200).json(result);
  } catch (e) {
    console.error("[api/stocks]", e);
    res.status(502).json({ error: e.message });
  }
}
