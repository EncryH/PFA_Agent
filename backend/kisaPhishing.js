// 한국인터넷진흥원(KISA) 피싱사이트 목록 조회 — 서버에서만 호출한다.
// data.go.kr "한국인터넷진흥원_피싱사이트" 파일데이터(CSV) 스냅샷을 로컬에 내려받아 쓴다.
// Google Safe Browsing과 달리 실시간 조회 API가 아니라 특정 시점 스냅샷이라, 최신 신규
// 피싱 사이트는 못 잡을 수 있다 — 그건 뒤에 Google Safe Browsing 조회로 보강한다(safebrowsing.js).
// 대신 API 키·네트워크 호출이 필요 없어 데모 중에도 끊기지 않고, 국내 금융기관 사칭
// 도메인에 특화돼 있다.
//
// CSV 스키마(헤더 2열): 날짜,홈페이지주소
// "홈페이지주소" 값은 형식이 섞여 있다 — 스킴 없는 순수 도메인("gh7w.yachts"), 스킴 있는
// 도메인("http://xnr.ae1t.yachts"), 단축URL처럼 경로가 붙은 값("https://link24.kr/9BUrXMH")이
// 함께 있다. 경로가 없는 항목은 도메인 전체가 피싱용으로 등록된 것이므로 도메인 단위로
// 매칭하고, 경로가 있는 항목(단축URL 등)은 그 경로까지 정확히 같을 때만 매칭한다 — 안 그러면
// link24.kr 같은 정상 단축URL 서비스 전체가 피싱으로 오탐된다.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const CSV_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "data", "kisa-phishing-sites.csv");

let index = null; // { exactUrls: Set<string>, domains: Set<string>, shortenerHosts: Map<string, number> } | undefined(로드 실패)

function normalizeEntry(raw) {
  const value = String(raw ?? "").trim().replace(/^https?:\/\//i, "").toLowerCase();
  if (!value) return null;
  const slashIdx = value.indexOf("/");
  const host = (slashIdx === -1 ? value : value.slice(0, slashIdx)).replace(/^www\./, "");
  const rawPath = slashIdx === -1 ? "" : value.slice(slashIdx);
  const trimmedPath = rawPath.replace(/\/+$/, "");
  if (!host || !host.includes(".")) return null;
  return { host, path: trimmedPath };
}

function loadIndex() {
  if (index !== null) return index;
  try {
    const text = readFileSync(CSV_PATH, "utf-8");
    const lines = text.split(/\r?\n/);
    const exactUrls = new Set();
    const domains = new Set();
    // 경로가 붙은(단축URL류) 항목만 세서, "이 호스트는 실제로는 단축URL 서비스라 도메인
    // 전체를 위험으로 볼 수 없지만, 이미 신고된 단축 링크가 여러 건 있다"를 구분해낸다.
    const shortenerHosts = new Map();
    // 첫 줄(헤더: 날짜,홈페이지주소)은 건너뛴다.
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const commaIdx = line.indexOf(",");
      if (commaIdx === -1) continue;
      const entry = normalizeEntry(line.slice(commaIdx + 1));
      if (!entry) continue;
      exactUrls.add(`${entry.host}${entry.path}`);
      if (!entry.path) {
        domains.add(entry.host);
      } else {
        shortenerHosts.set(entry.host, (shortenerHosts.get(entry.host) ?? 0) + 1);
      }
    }
    index = { exactUrls, domains, shortenerHosts };
  } catch (err) {
    console.error("[kisaPhishing] CSV 로드 실패 — 이 체크는 건너뛴다:", err.message);
    index = undefined; // 실패도 캐시해서 매 요청마다 재시도하지 않는다
  }
  return index;
}

/**
 * @returns {{
 *   threat: boolean,
 *   matchType?: 'exact' | 'domain',
 *   shortenerHost?: boolean,
 *   knownBadPaths?: number,
 * } | null} null = 판정 불가(파일 없음 등)
 */
export function checkKisaPhishing(url) {
  const idx = loadIndex();
  if (!idx) return null;
  const entry = normalizeEntry(url);
  if (!entry) return { threat: false };

  const exactKey = `${entry.host}${entry.path}`;
  if (idx.exactUrls.has(exactKey)) return { threat: true, matchType: "exact" };
  if (idx.domains.has(entry.host)) return { threat: true, matchType: "domain" };

  // 이 링크 자체는 목록에 없지만, 같은 호스트에서 발급된 다른 단축 링크가 이미 신고된
  // 적 있다 — 도메인 전체를 위험으로 보긴 어렵지만(정상 단축 링크도 섞여 있다), 그냥
  // "확인 불가"로 두면 사용자가 오해한다. 별도 신호로 알려서 "전체 링크를 붙여넣어
  // 달라"고 안내할 수 있게 한다.
  const shortenerCount = idx.shortenerHosts.get(entry.host);
  if (shortenerCount) return { threat: false, shortenerHost: true, knownBadPaths: shortenerCount };

  return { threat: false };
}
