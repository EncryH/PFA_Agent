import test from "node:test";
import assert from "node:assert/strict";

import {
  analyzePhoneSearchResults,
  buildPhoneSearchQueries,
  maskPhone,
  validatePhone,
  verifyPhoneWithNaverSearch,
} from "../tools/phone-web-verification.js";
import { searchNaverWebDocuments } from "../tools/naver-web-search.js";

const phone = "010-2468-1357";

function item({ link, title = "전화번호 조회", description }) {
  return { link, title, description };
}

test("전화번호를 검색용 형식으로 정규화하고 응답용으로 마스킹한다", () => {
  const result = validatePhone("+82 10-2468-1357");
  assert.equal(result.valid, true);
  assert.equal(result.normalized, "01024681357");
  assert.equal(result.formatted, phone);
  assert.equal(maskPhone(phone), "010-****-1357");
});

test("전화번호 형식과 위험 키워드를 조합해 검색 범위를 확장한다", () => {
  assert.deepEqual(buildPhoneSearchQueries(phone), [
    "010-2468-1357",
    "01024681357",
    "010-2468-1357 사기",
    "010-2468-1357 보이스피싱",
  ]);
  assert.deepEqual(buildPhoneSearchQueries("1588-9999", "KB국민은행"), [
    "1588-9999",
    "15889999",
    "1588-9999 KB국민은행",
    "1588-9999 사기",
    "1588-9999 보이스피싱",
  ]);
});

test("공식 대표번호도 NAVER 공식·위험 근거를 함께 검색한다", async () => {
  let searchCount = 0;
  const result = await verifyPhoneWithNaverSearch("1588-9999", {
    searchImpl: async () => {
      searchCount += 1;
      return {
        total: 1,
        items: [item({
          link: "https://www.kbstar.com/customer/contact",
          title: "KB국민은행 고객센터",
          description: "대표전화 1588-9999를 이용해 주세요.",
        })],
      };
    },
  });

  assert.equal(result.status, "safe");
  assert.equal(result.searchStatus, "ready");
  assert.equal(result.listChecks[0].matched, true);
  assert.equal(result.listChecks[0].detail, "KB국민은행의 공식 대표번호와 일치합니다.");
  assert.equal(result.listChecks[1].matched, true);
  assert.equal(result.listChecks[2].matched, false);
  assert.equal(result.sources[0].kind, "official");
  assert.equal(searchCount, 5);
});

test("공식번호와 NAVER 위험 정황이 함께 나오면 발신번호 조작을 고려해 주의로 판정한다", async () => {
  const result = await verifyPhoneWithNaverSearch("1588-9999", {
    searchImpl: async () => ({
      total: 1,
      items: [item({
        link: "https://community.example.com/spoofing",
        description: "1588-9999 번호를 이용한 보이스피싱 피해 신고",
      })],
    }),
  });

  assert.equal(result.status, "caution");
  assert.equal(result.institutionName, "KB국민은행");
  assert.equal(result.listChecks[2].matched, true);
});

test("로컬 목록에 없는 번호도 NAVER 공식 도메인과 예금보험공사 기관 일치로 확인한다", async () => {
  const result = await verifyPhoneWithNaverSearch("02-1234-5678", {
    searchImpl: async () => ({
      total: 1,
      items: [item({
        link: "https://www.kbstar.com/customer/contact",
        title: "KB국민은행 고객센터",
        description: "상담 전화 02-1234-5678",
      })],
    }),
    kdicConfig: {
      enabled: true,
      apiKey: "test-key",
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          getInsurgTrgetFnltInfoList: {
            header: { resultCode: "00" },
            item: [{ fnccmpNm: "국민은행(주)", cttpc: "02-0000-0000", isrgTgtYn: "Y" }],
          },
        }),
      }),
    },
  });

  assert.equal(result.status, "safe");
  assert.equal(result.institutionName, "KB국민은행");
  assert.equal(result.listChecks[0].matched, true);
  assert.equal(result.listChecks[1].matched, true);
  assert.match(result.listChecks[0].detail, /NAVER.*예금보험공사/);
});

test("예금보험공사 공개 연락처를 1단계 화이트리스트 근거로 사용한다", async () => {
  const result = await verifyPhoneWithNaverSearch("1588-9999", {
    kdicConfig: {
      enabled: true,
      apiKey: "test-key",
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          getInsurgTrgetFnltInfoList: {
            header: { resultCode: "00" },
            item: [{ fnccmpNm: "국민은행(주)", cttpc: "1588-9999", isrgTgtYn: "Y" }],
          },
        }),
      }),
    },
  });

  assert.equal(result.status, "safe");
  assert.equal(result.listChecks[0].matched, true);
  assert.match(result.listChecks[0].detail, /예금보험공사 부보금융회사/);
  assert.match(result.provider, /예금보험공사/);
});

test("예금보험공사 API 장애 시 로컬 공식번호 근거로 안전하게 폴백한다", async () => {
  const result = await verifyPhoneWithNaverSearch("1588-9999", {
    kdicConfig: {
      enabled: true,
      apiKey: "test-key",
      fetchImpl: async () => { throw new Error("temporary outage"); },
    },
  });

  assert.equal(result.status, "safe");
  assert.match(result.listChecks[0].detail, /로컬 공식 목록/);
});

test("위험번호는 NAVER 근거도 조회한 뒤 신고 이력으로 차단한다", async () => {
  let searchCount = 0;
  const result = await verifyPhoneWithNaverSearch("010-1234-5678", {
    searchImpl: async () => {
      searchCount += 1;
      return { total: 0, items: [] };
    },
  });

  assert.equal(result.status, "danger");
  assert.equal(result.listChecks[0].matched, false);
  assert.equal(result.listChecks[3].matched, true);
  assert.equal(result.thecheat.reportCount, 14);
  assert.equal(searchCount, 4);
});

test("공개 검색 결과가 없어도 안전으로 단정하지 않는다", async () => {
  const result = await verifyPhoneWithNaverSearch(phone, {
    searchImpl: async () => ({ total: 0, items: [] }),
  });

  assert.equal(result.status, "unknown");
  assert.equal(result.label, "공식 번호로 확인되지 않았어요");
  assert.match(result.detail, /공식 앱이나 대표번호/);
  assert.equal(result.listChecks.every(({ matched }) => !matched), true);
  assert.deepEqual(result.sources, []);
});

test("단일 비공식 출처의 위험 언급은 주의로 표시한다", async () => {
  const result = await verifyPhoneWithNaverSearch(phone, {
    searchImpl: async () => ({
      total: 1,
      items: [item({
        link: "https://community.example.com/report/1",
        description: "010-2468-1357 보이스피싱 피해 신고 글입니다.",
      })],
    }),
  });

  assert.equal(result.status, "caution");
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].trusted, false);
});

test("서로 다른 복수 출처의 사기 피해 정황은 위험으로 표시한다", () => {
  const analysis = analyzePhoneSearchResults(phone, [{
    total: 2,
    items: [
      item({ link: "https://first.example/report", description: "010-2468-1357 대출사기 피해 신고" }),
      item({ link: "https://second.example/report", description: "01024681357 기관 사칭 보이스피싱 제보" }),
    ],
  }]);

  assert.equal(analysis.danger, true);
  assert.equal(analysis.evidence.length, 2);
});

test("공식 사이트의 예방 안내는 공식 근거로만 쓰고 위험 신고로 중복 해석하지 않는다", () => {
  const analysis = analyzePhoneSearchResults("1588-9999", [{
    total: 1,
    items: [item({
      link: "https://www.kbstar.com/security/voice-phishing",
      description: "보이스피싱이 의심되면 KB국민은행 1588-9999로 확인하세요.",
    })],
  }]);

  assert.equal(analysis.officialEvidence.length, 1);
  assert.equal(analysis.riskEvidence.length, 0);
  assert.equal(analysis.caution, false);
});

test("NAVER 웹문서 클라이언트는 API HUB 주소와 서버 전용 헤더를 사용한다", async () => {
  let captured;
  const result = await searchNaverWebDocuments(phone, {
    clientId: "test-id",
    clientSecret: "test-secret",
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          total: 1,
          items: [{ title: "<b>검색 결과</b>", link: "https://example.com", description: "설명" }],
        }),
      };
    },
  });

  assert.equal(captured.url.pathname, "/search/v1/webkr");
  assert.equal(captured.options.headers["X-NCP-APIGW-API-KEY-ID"], "test-id");
  assert.equal(captured.options.headers["X-NCP-APIGW-API-KEY"], "test-secret");
  assert.equal(result.items[0].title, "검색 결과");
  assert.equal("clientSecret" in result, false);
});

test("검색 결과 링크는 HTTP·HTTPS 주소만 화면 근거로 허용한다", async () => {
  const result = await searchNaverWebDocuments(phone, {
    clientId: "test-id",
    clientSecret: "test-secret",
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        total: 2,
        items: [
          { title: "정상", link: "https://example.com/report", description: "내용" },
          { title: "제외", link: "javascript:alert(1)", description: "내용" },
        ],
      }),
    }),
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].link, "https://example.com/report");
});
