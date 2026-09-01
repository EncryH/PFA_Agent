// 주식 시세 조회 — Yahoo Finance 차트 API를 서버에서 대신 호출해 CORS를 우회한다.
// Vite 개발 프록시와 Vercel 함수가 같은 구현을 사용한다.

const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

async function fetchQuote(symbol) {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      { headers: { "User-Agent": USER_AGENT } },
    );
    if (!response.ok) throw new Error(`upstream ${response.status}`);
    const data = await response.json();
    const meta = data?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    const previousClose = meta?.chartPreviousClose ?? meta?.previousClose;
    if (typeof price !== "number" || typeof previousClose !== "number") {
      throw new Error("no data");
    }
    return {
      symbol,
      ok: true,
      price,
      changePct: ((price - previousClose) / previousClose) * 100,
    };
  } catch (error) {
    return { symbol, ok: false, error: error.message };
  }
}

export async function fetchStockQuotes(symbols) {
  const quotes = await Promise.all(symbols.map(fetchQuote));
  return { quotes, fetchedAt: Date.now() };
}
