const DEFAULT_BASE_URL = "https://naverapihub.apigw.ntruss.com";
const DEFAULT_TIMEOUT_MS = 4500;

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function stripSearchMarkup(value = "") {
  return String(value)
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function safeHttpLink(value) {
  try {
    const url = new URL(String(value ?? ""));
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

/**
 * NAVER API HUB 웹문서 검색 클라이언트.
 * 인증값은 서버에서만 받고 결과에는 절대 포함하지 않는다.
 */
export async function searchNaverWebDocuments(query, {
  clientId,
  clientSecret,
  baseUrl = DEFAULT_BASE_URL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  display = 10,
  fetchImpl = fetch,
} = {}) {
  if (!clientId || !clientSecret) {
    throw new Error("NAVER API HUB 인증 정보가 없습니다.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), positiveInteger(timeoutMs, DEFAULT_TIMEOUT_MS));
  const endpoint = `${String(baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "")}/search/v1/webkr`;
  const url = new URL(endpoint);
  url.searchParams.set("query", String(query));
  url.searchParams.set("display", String(Math.min(100, positiveInteger(display, 10))));
  url.searchParams.set("start", "1");
  url.searchParams.set("format", "json");

  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: {
        "X-NCP-APIGW-API-KEY-ID": clientId,
        "X-NCP-APIGW-API-KEY": clientSecret,
      },
      signal: controller.signal,
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const code = body?.error?.errorCode ?? body?.errorCode ?? `HTTP_${response.status}`;
      throw new Error(`NAVER 웹문서 검색 실패 (${code})`);
    }

    return {
      total: Number(body?.total ?? 0),
      items: Array.isArray(body?.items)
        ? body.items.map((item) => ({
            title: stripSearchMarkup(item?.title),
            link: safeHttpLink(item?.link),
            description: stripSearchMarkup(item?.description),
          })).filter((item) => item.link)
        : [],
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("NAVER 웹문서 검색 시간이 초과되었습니다.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
