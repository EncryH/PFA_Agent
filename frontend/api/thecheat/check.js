// Vercel 서버리스 함수 — POST /api/thecheat/check { query: string }
// 데이터·조회 로직은 backend/thecheat.js — dev 서버 프록시와 공유한다.

import { lookupThecheat } from "../../../backend/thecheat.js";

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }
  try {
    const hit = lookupThecheat(String(req.body?.query ?? ""));
    res.status(200).json({
      data: hit
        ? { found: true, ...hit }
        : { found: false, reportCount: 0, scamTypes: [], lastReported: "" },
    });
  } catch (e) {
    console.error("[api/thecheat/check]", e);
    res.status(500).json({ error: e.message });
  }
}
