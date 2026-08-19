// 주식 시세 조회 — Yahoo Finance 차트 API를 서버에서 대신 호출해 CORS를 우회한다.
// Vite dev 프록시와 Vercel 서버리스 함수 양쪽에서 이 모듈을 그대로 가져다 쓴다.

const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

async function fetchQuote(symbol) {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      { headers: { "User-Agent": USER_AGENT } },
    );
    if (!r.ok) throw new Error(`upstream ${r.status}`);
    const data = await r.json();
    const meta = data?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    const prevClose = meta?.chartPreviousClose ?? meta?.previousClose;
    if (typeof price !== "number" || typeof prevClose !== "number") throw new Error("no data");
    return { symbol, ok: true, price, changePct: ((price - prevClose) / prevClose) * 100 };
  } catch (e) {
    return { symbol, ok: false, error: e.message };
  }
}

export async function fetchStockQuotes(symbols) {
  const quotes = await Promise.all(symbols.map(fetchQuote));
  return { quotes, fetchedAt: Date.now() };
}
