import { matchWhitelist, OFFICIAL_CONTACTS } from "../rules/whitelist.js";
import { matchBlacklist } from "../rules/blacklist.js";
import { findKdicWhitelistEvidence } from "./kdic-financial-companies.js";
import { searchNaverWebDocuments } from "./naver-web-search.js";

const HIGH_RISK_SIGNALS = Object.freeze([
  { code: "VOICE_PHISHING", label: "보이스피싱", pattern: /보이스\s*피싱|전화금융사기/i },
  { code: "LOAN_SCAM", label: "대출사기", pattern: /대출\s*사기|불법\s*대출|작업\s*대출/i },
  { code: "IMPERSONATION", label: "기관 사칭", pattern: /기관\s*사칭|검찰\s*사칭|경찰\s*사칭|금융기관\s*사칭/i },
  { code: "SMISHING", label: "스미싱·피싱", pattern: /스미싱|피싱\s*(전화|문자|번호)?/i },
  { code: "FRAUD_REPORT", label: "사기 신고·피해", pattern: /사기\s*(신고|전화|번호|피해|제보)|피해\s*(사례|신고|제보)/i },
]);

const CAUTION_SIGNALS = Object.freeze([
  { code: "SUSPICIOUS_CALL", label: "의심 전화", pattern: /의심\s*(전화|번호)|주의\s*(전화|번호)|수상한\s*(전화|번호)/i },
  { code: "SPAM", label: "스팸", pattern: /스팸\s*(전화|번호|신고)?|광고\s*전화/i },
  { code: "COLLECTION", label: "추심·독촉", pattern: /채권\s*추심|대출\s*독촉|상환\s*독촉/i },
]);

const TRUSTED_EVIDENCE_DOMAINS = Object.freeze([
  "police.go.kr",
  "fss.or.kr",
  "fsc.go.kr",
  "kisa.or.kr",
  "spam.kisa.or.kr",
  "gov.kr",
]);

export function normalizePhone(raw) {
  const input = String(raw ?? "").trim();
  if (!input) return "";
  if (input.startsWith("+82")) return `0${input.slice(3).replace(/\D/g, "")}`;
  return input.replace(/\D/g, "");
}

export function formatPhone(phone) {
  const digits = normalizePhone(phone);
  if (/^02\d{7,8}$/.test(digits)) {
    const middleLength = digits.length === 9 ? 3 : 4;
    return `02-${digits.slice(2, 2 + middleLength)}-${digits.slice(2 + middleLength)}`;
  }
  if (/^0\d{9,10}$/.test(digits)) {
    const middleLength = digits.length === 10 ? 3 : 4;
    return `${digits.slice(0, 3)}-${digits.slice(3, 3 + middleLength)}-${digits.slice(3 + middleLength)}`;
  }
  if (/^1\d{7}$/.test(digits)) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return digits;
}

export function maskPhone(phone) {
  const formatted = formatPhone(phone);
  const parts = formatted.split("-");
  if (parts.length === 3) return `${parts[0]}-${"*".repeat(parts[1].length)}-${parts[2]}`;
  if (parts.length === 2) return `${parts[0]}-${"*".repeat(parts[1].length)}`;
  if (formatted.length > 4) return `${formatted.slice(0, 3)}-${"*".repeat(formatted.length - 7)}-${formatted.slice(-4)}`;
  return "****";
}

export function validatePhone(raw) {
  const normalized = normalizePhone(raw);
  const valid = /^(?:0\d{8,10}|1\d{2,7})$/.test(normalized);
  return { valid, normalized, formatted: formatPhone(normalized), masked: maskPhone(normalized) };
}

export function buildPhoneSearchQueries(phone, institutionName = "") {
  const normalized = normalizePhone(phone);
  const formatted = formatPhone(normalized);

  return [...new Set([
    formatted,
    normalized,
    institutionName ? `${formatted} ${institutionName}` : "",
    `${formatted} 사기`,
    `${formatted} 보이스피싱`,
  ].filter(Boolean))];
}

function hostnameOf(link) {
  try {
    return new URL(link).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isTrustedEvidence(link) {
  const hostname = hostnameOf(link);
  return TRUSTED_EVIDENCE_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

function isDomainMatch(hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function officialDomainEntries(extraEntries = []) {
  const entries = [
    ...OFFICIAL_CONTACTS.filter(({ type }) => type === "domain"),
    ...extraEntries,
  ];
  const seen = new Set();
  return entries.filter(({ value, name }) => {
    const domain = hostnameOf(value.includes("://") ? value : `https://${value}`);
    const key = `${domain}:${name}`;
    if (!domain || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(({ value, name }) => ({
    domain: hostnameOf(value.includes("://") ? value : `https://${value}`),
    name,
  }));
}

function mentionsPhone(item, normalized) {
  const candidates = `${item.title} ${item.description}`.match(/\+?\d[\d\s-]{1,14}\d/g) ?? [];
  return candidates.some((candidate) => normalizePhone(candidate) === normalized);
}

function findSignals(text) {
  const high = HIGH_RISK_SIGNALS.filter(({ pattern }) => pattern.test(text));
  const caution = CAUTION_SIGNALS.filter(({ pattern }) => pattern.test(text));
  return { high, caution };
}

export function analyzePhoneSearchResults(phone, searchResponses = [], options = {}) {
  const normalized = normalizePhone(phone);
  const seenRiskLinks = new Set();
  const seenOfficialLinks = new Set();
  const riskEvidence = [];
  const officialEvidence = [];
  const domains = officialDomainEntries(options.officialDomains);
  let total = 0;

  for (const response of searchResponses) {
    total = Math.max(total, Number(response?.total ?? 0));
    for (const item of response?.items ?? []) {
      if (!item?.link || !mentionsPhone(item, normalized)) continue;

      const hostname = hostnameOf(item.link);
      const officialDomain = domains.find(({ domain }) => isDomainMatch(hostname, domain));
      if (officialDomain && !seenOfficialLinks.has(item.link)) {
        seenOfficialLinks.add(item.link);
        officialEvidence.push({
          title: item.title,
          url: item.link,
          description: item.description,
          signals: ["공식 사이트 번호 일치"],
          severity: "official",
          kind: "official",
          trusted: true,
          institutionName: officialDomain.name,
        });
      }
      // 금융회사 공식 사이트의 보이스피싱 예방 안내는 그 번호의 신고 근거가 아니므로
      // 같은 문서를 NAVER 위험 정황으로 중복 해석하지 않는다.
      if (officialDomain) continue;

      const text = `${item.title} ${item.description}`;
      const { high, caution } = findSignals(text);
      if ((!high.length && !caution.length) || seenRiskLinks.has(item.link)) continue;
      seenRiskLinks.add(item.link);

      riskEvidence.push({
        title: item.title,
        url: item.link,
        description: item.description,
        signals: [...high, ...caution].map(({ label }) => label),
        severity: high.length ? "high" : "caution",
        kind: "risk",
        trusted: isTrustedEvidence(item.link),
        hostname: hostnameOf(item.link),
      });
    }
  }

  const highEvidence = riskEvidence.filter(({ severity }) => severity === "high");
  const distinctHighHosts = new Set(highEvidence.map(({ hostname }) => hostname).filter(Boolean));
  const hasTrustedHigh = highEvidence.some(({ trusted }) => trusted);
  const danger = hasTrustedHigh || distinctHighHosts.size >= 2;

  return {
    total,
    officialEvidence: officialEvidence.slice(0, 3),
    riskEvidence: riskEvidence.slice(0, 5).map(({ hostname: _hostname, ...item }) => item),
    evidence: [
      ...officialEvidence.slice(0, 3),
      ...riskEvidence.slice(0, 5).map(({ hostname: _hostname, ...item }) => item),
    ].slice(0, 6),
    danger,
    caution: !danger && riskEvidence.length > 0,
  };
}

/**
 * 공식 번호 목록과 NAVER 공개 웹문서를 결합해 전화번호를 검증한다.
 * 검색 결과가 없다는 이유만으로 안전 판정을 내리지 않는다.
 */
export async function verifyPhoneWithNaverSearch(rawPhone, config = {}) {
  const phone = validatePhone(rawPhone);
  if (!phone.valid) {
    const error = new Error("올바른 국내 전화번호를 입력해 주세요.");
    error.code = "INVALID_PHONE";
    throw error;
  }

  // 070 인터넷전화 — 공식 금융·정부기관은 쓰지 않는 채널이라 검색 근거 없이도 바로 위험 처리한다.
  // (수신전화 화면의 callscreen.ts와 같은 판정을 여기서도 유지한다.)
  if (phone.normalized.startsWith("070")) {
    return {
      status: "danger",
      label: "070 인터넷전화",
      maskedPhone: phone.masked,
      detail: "공식 금융·정부기관은 070 번호를 사용하지 않습니다. 보이스피싱을 의심하세요.",
    };
  }

  const localOfficial = matchWhitelist({ phone: phone.normalized });
  const blacklisted = matchBlacklist(phone.normalized);
  let kdicEvidence = null;
  let kdicStatus = "disabled";

  if (String(config.kdicConfig?.enabled).toLowerCase() === "true" || config.kdicConfig?.enabled === true) {
    try {
      kdicEvidence = await findKdicWhitelistEvidence({
        phone: phone.normalized,
        companyName: localOfficial?.name,
      }, config.kdicConfig);
      kdicStatus = "ready";
    } catch {
      // 공공 API 장애가 1단계 전체를 멈추지 않도록 로컬 공식번호·위험번호·웹검색으로 계속 판정한다.
      kdicStatus = "unavailable";
    }
  }

  const kdicPhoneMatch = kdicEvidence?.matched && kdicEvidence.matchType === "phone"
    ? kdicEvidence.company
    : null;
  const kdicInstitutionMatch = kdicEvidence?.matched && kdicEvidence.matchType === "institution"
    ? kdicEvidence.company
    : null;
  let official = kdicPhoneMatch
    ? { name: kdicPhoneMatch.name, type: "phone", value: phone.normalized }
    : localOfficial;

  const naverReady = Boolean(config.searchImpl) || (
    String(config.enabled).toLowerCase() === "true"
    && config.clientId
    && config.clientSecret
  );
  let analysis = {
    total: 0,
    officialEvidence: [],
    riskEvidence: [],
    evidence: [],
    danger: false,
    caution: false,
  };
  let searchStatus = "skipped";

  if (naverReady) {
    const queries = buildPhoneSearchQueries(phone.normalized, official?.name);
    const search = config.searchImpl ?? ((query) => searchNaverWebDocuments(query, config));
    const settled = await Promise.allSettled(queries.map((query) => search(query)));
    const responses = settled.filter(({ status }) => status === "fulfilled").map(({ value }) => value);
    searchStatus = responses.length === queries.length ? "ready" : responses.length ? "partial" : "unavailable";

    if (responses.length) {
      const kdicCompany = kdicPhoneMatch ?? kdicInstitutionMatch;
      const extraOfficialDomains = kdicCompany?.homepage
        ? [{ value: kdicCompany.homepage, name: kdicCompany.name }]
        : [];
      analysis = analyzePhoneSearchResults(phone.normalized, responses, {
        officialDomains: extraOfficialDomains,
      });
    }
  }

  const webOfficial = analysis.officialEvidence[0] ?? null;
  if (!official && webOfficial) {
    official = { name: webOfficial.institutionName, type: "phone", value: phone.normalized };
  }

  let webKdicInstitution = null;
  if (webOfficial && !kdicPhoneMatch && !kdicInstitutionMatch
    && (String(config.kdicConfig?.enabled).toLowerCase() === "true" || config.kdicConfig?.enabled === true)) {
    try {
      const webKdicEvidence = await findKdicWhitelistEvidence({
        phone: phone.normalized,
        companyName: webOfficial.institutionName,
      }, config.kdicConfig);
      if (webKdicEvidence.matched) webKdicInstitution = webKdicEvidence.company;
    } catch {
      // NAVER 공식 도메인 근거는 유지하고 예보 보강 근거만 생략한다.
    }
  }

  const kdicConfirmedCompany = kdicPhoneMatch ?? kdicInstitutionMatch ?? webKdicInstitution;
  const whitelistDetail = kdicPhoneMatch
    ? `예금보험공사 부보금융회사 ${kdicPhoneMatch.name}의 공개 연락처와 일치합니다.`
    : localOfficial && kdicConfirmedCompany
      ? `공식 대표번호와 일치하며, 예금보험공사 부보금융회사 ${kdicConfirmedCompany.name}도 확인했습니다.`
      : webOfficial && kdicConfirmedCompany
        ? `NAVER의 ${webOfficial.institutionName} 공식 사이트와 예금보험공사 부보금융회사 정보를 함께 확인했습니다.`
        : localOfficial && kdicStatus === "unavailable"
          ? `예금보험공사 조회가 원활하지 않아 로컬 공식 목록에서 ${localOfficial.name}의 대표번호를 확인했습니다.`
          : localOfficial
            ? `${localOfficial.name}의 공식 대표번호와 일치합니다.`
            : webOfficial
              ? `NAVER 검색 결과의 ${webOfficial.institutionName} 공식 사이트에서 번호를 확인했습니다.`
              : kdicStatus === "unavailable"
                ? "예금보험공사 조회가 원활하지 않았고, 공식 번호 목록에서도 일치 항목을 찾지 못했습니다."
                : "예금보험공사 부보금융회사 연락처와 공식 번호 목록에서 일치 항목을 찾지 못했습니다.";

  const naverOfficialDetail = searchStatus === "unavailable"
    ? "NAVER 공식 출처 검색을 완료하지 못했습니다."
    : searchStatus === "skipped"
      ? "NAVER 검색 설정이 없어 공식 출처 확인을 건너뛰었습니다."
      : webOfficial
        ? `${webOfficial.institutionName} 공식 사이트에서 입력 번호가 포함된 공개 문서를 확인했습니다.`
        : "NAVER 검색 결과의 공식 기관 도메인에서 입력 번호를 확인하지 못했습니다.";
  const naverRiskDetail = searchStatus === "unavailable"
    ? "NAVER 위험 정황 검색을 완료하지 못했습니다."
    : searchStatus === "skipped"
      ? "NAVER 검색 설정이 없어 위험 정황 확인을 건너뛰었습니다."
      : analysis.riskEvidence.length
        ? `입력 번호가 포함된 사기·피싱·스팸 관련 문서 ${analysis.riskEvidence.length}건을 확인했습니다.`
        : "NAVER 공개 웹문서에서 입력 번호와 함께 언급된 위험 정황을 찾지 못했습니다.";

  const listChecks = [
    {
      type: "whitelist",
      matched: Boolean(localOfficial || kdicPhoneMatch || kdicInstitutionMatch || webKdicInstitution),
      available: Boolean(localOfficial) || kdicStatus === "ready",
      label: "예금보험공사·공식 번호",
      detail: whitelistDetail,
    },
    {
      type: "whitelist",
      matched: Boolean(webOfficial),
      available: searchStatus !== "unavailable" && searchStatus !== "skipped",
      label: "NAVER 공식 출처",
      detail: naverOfficialDetail,
    },
    {
      type: "blacklist",
      matched: analysis.riskEvidence.length > 0,
      available: searchStatus !== "unavailable" && searchStatus !== "skipped",
      label: "NAVER 위험 정황",
      detail: naverRiskDetail,
    },
    {
      type: "blacklist",
      matched: Boolean(blacklisted),
      available: true,
      label: "위험번호 신고 이력",
      detail: blacklisted
        ? `피해 신고 ${blacklisted.reportCount}건 · ${blacklisted.scamTypes.join(", ")}`
        : "현재 대조한 위험번호 신고 이력에서 일치 항목이 없습니다.",
    },
  ];

  const provider = naverReady
    ? "예금보험공사·NAVER 공식/위험 근거 결합 확인"
    : "예금보험공사·공식번호·위험번호 결합 확인";
  const common = {
    maskedPhone: phone.masked,
    searchStatus,
    provider,
    listChecks,
    sources: analysis.evidence,
    searchTotal: analysis.total,
  };

  if (official && blacklisted) {
    return {
      ...common,
      status: "caution",
      label: "공식 번호지만 추가 확인이 필요해요",
      institutionName: official.name,
      detail: "공식번호 근거가 있지만 위험번호 신고 이력에도 일치합니다. 발신번호가 조작됐을 수 있으므로 전화를 끊고 공식 앱에서 직접 다시 연결하세요.",
      thecheat: blacklisted,
    };
  }

  if (blacklisted) {
    return {
      ...common,
      status: "danger",
      label: "위험번호 신고 이력에서 확인됐어요",
      detail: `위험번호 신고 이력에서 피해 신고 ${blacklisted.reportCount}건이 확인됐습니다. 연락과 송금을 멈추고 개인정보를 전달하지 마세요.`,
      thecheat: blacklisted,
    };
  }

  if (official && (analysis.danger || analysis.caution)) {
    const officialConfirmations = [
      Boolean(localOfficial),
      Boolean(kdicPhoneMatch || kdicInstitutionMatch || webKdicInstitution),
      Boolean(webOfficial),
    ].filter(Boolean).length;
    if (officialConfirmations >= 2) {
      return {
        ...common,
        status: "safe",
        label: `${official.name} 공식 대표번호예요`,
        institutionName: official.name,
        detail: `예금보험공사·공식번호 근거가 다중 확인됐습니다. 웹 검색에서 이 번호를 사칭한 사기·피싱 사례가 발견됐지만, 번호 자체는 ${official.name}의 공식 연락처입니다. 다만 발신번호 조작 가능성은 있으므로 중요한 요청은 공식 앱에서 다시 확인하세요.`,
      };
    }
    return {
      ...common,
      status: "caution",
      label: `${official.name} 공식번호지만 추가 확인이 필요해요`,
      institutionName: official.name,
      detail: "공식번호 근거와 함께 사기·피싱 또는 스팸 관련 웹문서도 확인됐습니다. 발신번호 조작 가능성이 있으므로 전화를 끊고 공식 앱에서 직접 다시 연결하세요.",
    };
  }

  if (official) {
    const webConfirmation = webOfficial
      ? "NAVER의 공식 사이트에서도 동일 번호를 확인했고, "
      : "";
    return {
      ...common,
      status: "safe",
      label: `${official.name} 공식 대표번호예요`,
      institutionName: official.name,
      detail: `예금보험공사·공식번호 근거가 확인됐습니다. ${webConfirmation}현재 위험번호 신고 이력과 NAVER 위험 검색에서 뚜렷한 위험 정황은 확인되지 않았습니다. 다만 발신번호 조작 가능성은 있으므로 중요한 요청은 공식 앱에서 다시 확인하세요.`,
    };
  }

  if (analysis.danger) {
    return {
      ...common,
      status: "danger",
      label: "위험 정황이 발견됐어요",
      detail: "입력한 번호와 함께 사기·피싱 피해 정황이 언급된 공개 웹문서가 확인됐습니다. 송금하거나 개인정보를 전달하지 마세요.",
    };
  }

  if (analysis.caution) {
    return {
      ...common,
      status: "caution",
      label: "주의가 필요한 정황이 있어요",
      detail: "입력한 번호와 관련된 의심·스팸 정황이 검색됐습니다. 상대방이 안내한 번호가 아닌 기관 공식 채널로 다시 확인하세요.",
    };
  }

  return {
    ...common,
    status: "unknown",
    label: "공식 번호로 확인되지 않았어요",
    detail: "공식 대표번호 목록과 공개 웹문서에서는 이 번호의 안전 여부를 확인할 근거를 찾지 못했습니다. 상대방이 알려준 번호로 다시 연락하지 말고 해당 기관의 공식 앱이나 대표번호로 확인하세요.",
  };
}
