const DEFAULT_BASE_URL = "https://apis.data.go.kr/B190017/service/GetInsurgTrgetFnltInfoService";
const LIST_OPERATION = "getInsurgTrgetFnltInfoList";
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

let cachedCompanies = null;
let cacheExpiresAt = 0;
let cachedEndpoint = "";

function normalizeServiceKey(value) {
  const key = String(value ?? "").trim();
  if (!key.includes("%")) return key;

  try {
    // data.go.kr의 "일반 인증키(Encoding)"는 URLSearchParams에 넣기 전 한 번만 디코딩한다.
    return decodeURIComponent(key);
  } catch {
    return key;
  }
}

export function buildKdicListEndpoint(baseUrl = DEFAULT_BASE_URL) {
  const trimmed = String(baseUrl || DEFAULT_BASE_URL).trim().replace(/\/+$/, "");
  return trimmed.endsWith(`/${LIST_OPERATION}`) ? trimmed : `${trimmed}/${LIST_OPERATION}`;
}

function normalizePhone(value) {
  const input = String(value ?? "").trim();
  if (input.startsWith("+82")) return `0${input.slice(3).replace(/\D/g, "")}`;
  return input.replace(/\D/g, "");
}

function extractPhoneNumbers(contact) {
  const candidates = String(contact ?? "").match(/\+?\d[\d\s().-]{5,}\d/g) ?? [];
  return [...new Set(candidates.map(normalizePhone).filter((phone) => phone.length >= 8))];
}

function canonicalCompanyName(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toUpperCase()
    .replace(/주식회사|\(주\)|㈜/g, "")
    .replace(/[\s.,·()_-]/g, "")
    .replace(/^(KB|IBK|NH|SC|BNK|DGB)/, "");
}

function mapCompany(item) {
  const contact = String(item?.cttpc ?? "").trim();
  return {
    name: String(item?.fnccmpNm ?? "").trim(),
    sector: String(item?.fncsecDscdNm ?? "").trim(),
    address: String(item?.fncIstAdr ?? "").trim(),
    contact,
    phones: extractPhoneNumbers(contact),
    homepage: String(item?.hmpgUrladr ?? "").trim(),
    insured: String(item?.isrgTgtYn ?? "").trim().toUpperCase() !== "N",
  };
}

function readResponseBody(payload) {
  const body = payload?.getInsurgTrgetFnltInfoList ?? payload?.response?.body ?? payload?.body;
  const header = payload?.getInsurgTrgetFnltInfoList?.header ?? payload?.response?.header ?? payload?.header;
  const resultCode = String(header?.resultCode ?? "").trim();

  if (resultCode && resultCode !== "00") {
    throw new Error(`예금보험공사 API 오류(${resultCode})`);
  }

  const rawItems = body?.item ?? body?.items?.item ?? [];
  return (Array.isArray(rawItems) ? rawItems : [rawItems])
    .filter(Boolean)
    .map(mapCompany)
    .filter(({ name, insured }) => name && insured);
}

export async function fetchKdicFinancialCompanies(config = {}) {
  const enabled = String(config.enabled).toLowerCase() === "true" || config.enabled === true;
  if (!enabled) {
    const error = new Error("예금보험공사 API가 비활성화되어 있습니다.");
    error.code = "KDIC_DISABLED";
    throw error;
  }

  const serviceKey = normalizeServiceKey(config.apiKey);
  if (!serviceKey) {
    const error = new Error("예금보험공사 API 인증키가 없습니다.");
    error.code = "KDIC_CONFIG_MISSING";
    throw error;
  }

  const endpoint = buildKdicListEndpoint(config.baseUrl);
  const now = Date.now();
  const useSharedCache = !config.fetchImpl;
  if (useSharedCache && cachedCompanies && cachedEndpoint === endpoint && cacheExpiresAt > now) {
    return cachedCompanies;
  }

  const url = new URL(endpoint);
  url.searchParams.set("ServiceKey", serviceKey);
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "1000");
  url.searchParams.set("resultType", "json");

  const controller = new AbortController();
  const timeoutMs = Number(config.timeoutMs) || DEFAULT_TIMEOUT_MS;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await (config.fetchImpl ?? fetch)(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`예금보험공사 API HTTP ${response.status}`);

    const companies = readResponseBody(await response.json());
    if (!companies.length) throw new Error("예금보험공사 API에서 금융회사 정보를 받지 못했습니다.");

    if (useSharedCache) {
      cachedCompanies = companies;
      cachedEndpoint = endpoint;
      cacheExpiresAt = now + (Number(config.cacheTtlMs) || DEFAULT_CACHE_TTL_MS);
    }
    return companies;
  } finally {
    clearTimeout(timeout);
  }
}

export async function findKdicWhitelistEvidence({ phone, companyName } = {}, config = {}) {
  const companies = await fetchKdicFinancialCompanies(config);
  const normalizedPhone = normalizePhone(phone);

  const phoneMatch = normalizedPhone
    ? companies.find(({ phones }) => phones.includes(normalizedPhone))
    : null;
  if (phoneMatch) return { matched: true, matchType: "phone", company: phoneMatch };

  const canonicalName = canonicalCompanyName(companyName);
  const companyMatch = canonicalName
    ? companies.find(({ name }) => canonicalCompanyName(name) === canonicalName)
    : null;
  if (companyMatch) return { matched: true, matchType: "institution", company: companyMatch };

  return { matched: false, matchType: null, company: null };
}

export function clearKdicCacheForTests() {
  cachedCompanies = null;
  cacheExpiresAt = 0;
  cachedEndpoint = "";
}
