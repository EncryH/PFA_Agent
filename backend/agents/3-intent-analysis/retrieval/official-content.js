// 사기 유형별 공식 사례·영상 연결
//
// 왜 사전 큐레이션인가:
//   1. LLM이 URL이나 사건을 지어내지 못하게 한다 (환각 차단)
//   2. 송금 도중 외부 사이트를 호출하면 응답이 늦어지고, 그 사이트가 죽으면 화면도 멈춘다
//   3. 조회가 0ms — 부모님을 기다리게 하지 않는다
//
// 갱신은 런타임이 아니라 오프라인 스크립트가 한다.
// (datasets/rag/cases/official-content-catalog.json — 공식 사례·영상 카탈로그)

import { existsSync, readFileSync } from "node:fs";

const catalogUrl = new URL("../datasets/rag/cases/official-content-catalog.json", import.meta.url);
const EMPTY_CATALOG = Object.freeze({
  curated_at: "embedded-fallback",
  sources: [{
    key: "fss_phishing_keeper",
    name: "금융감독원 보이스피싱 지킴이",
    base: "https://www.fss.or.kr",
    boards: {
      cases: "/fss/bbs/B0000206/list.do?menuNo=200690",
    },
  }],
  byFraudType: {
    loan_advance_fee: {
      headline: "대출 전에 보증금·수수료를 먼저 요구하는 경우",
      caseLabel: "대출사기 예방 사례",
      caseBoard: "cases",
      video: {
        title: "대출사기 예방 안내",
        duration: "공식 영상",
        source: "금융감독원",
        id: "9J7lT4L7YVA",
      },
    },
    other: {
      headline: "송금 요구 전 공식 경로 확인",
      caseLabel: "보이스피싱 예방 사례",
      caseBoard: "cases",
    },
  },
});

function loadCatalog() {
  if (!existsSync(catalogUrl)) return EMPTY_CATALOG;
  return JSON.parse(readFileSync(catalogUrl, "utf8"));
}

const catalog = loadCatalog();

const FSS = catalog.sources.find((source) => source.key === "fss_phishing_keeper");

/** 유형 코드 → 부모님께 보여줄 공식 자료 */
export function retrieveOfficialContent(fraudTypeCode = "") {
  // 사기 의심이 없거나 유형이 불확실하면 자료를 붙이지 않는다.
  // 애매한 상황에 사기 영상을 보여주면 불필요한 불안을 만든다.
  if (!fraudTypeCode || ["none", "unknown"].includes(fraudTypeCode)) {
    return { status: "not_applicable", items: [] };
  }

  const entry = catalog.byFraudType[fraudTypeCode] ?? catalog.byFraudType.other;
  if (!entry) return { status: "not_configured", items: [] };

  const items = [];

  if (entry.video) {
    items.push({
      kind: "video",
      headline: entry.headline,
      title: entry.video.title,
      duration: entry.video.duration,
      source: entry.video.source,
      videoId: entry.video.id,
      // 썸네일은 API 키 없이 바로 쓸 수 있는 정적 경로다 (할당량 소모 없음)
      thumbnailUrl: `https://i.ytimg.com/vi/${entry.video.id}/mqdefault.jpg`,
      // 앱 안에서 재생 — 재호스팅이 아니라 공식 임베드라 약관에 맞는다
      embedUrl: `https://www.youtube-nocookie.com/embed/${entry.video.id}?rel=0`,
      watchUrl: `https://www.youtube.com/watch?v=${entry.video.id}`,
    });
  }

  const boardPath = FSS?.boards?.[entry.caseBoard];
  if (boardPath) {
    items.push({
      kind: "case_board",
      title: entry.caseLabel,
      source: FSS.name,
      url: `${FSS.base}${boardPath}`,
    });
  }

  return {
    status: "curated",
    curated_at: catalog.curated_at,
    fraud_type: fraudTypeCode,
    items,
  };
}

export const officialContentSummary = Object.freeze({
  curated_at: catalog.curated_at,
  types: Object.keys(catalog.byFraudType).length,
  sources: catalog.sources.map((source) => source.name),
});
