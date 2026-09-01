import test from "node:test";
import assert from "node:assert/strict";

import {
  buildKdicListEndpoint,
  fetchKdicFinancialCompanies,
  findKdicWhitelistEvidence,
} from "../tools/kdic-financial-companies.js";

function kdicResponse(items) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      getInsurgTrgetFnltInfoList: {
        header: { resultCode: "00", resultMsg: "NORMAL SERVICE" },
        item: items,
        totalCount: items.length,
      },
    }),
  };
}

test("서비스 기본 End Point에 목록 조회 경로를 정확히 붙인다", () => {
  const base = "https://apis.data.go.kr/B190017/service/GetInsurgTrgetFnltInfoService";
  const full = `${base}/getInsurgTrgetFnltInfoList`;
  assert.equal(buildKdicListEndpoint(base), full);
  assert.equal(buildKdicListEndpoint(full), full);
});

test("일반 인증키 Encoding 값을 한 번 정규화하고 부보금융회사 응답을 읽는다", async () => {
  let capturedUrl;
  const companies = await fetchKdicFinancialCompanies({
    enabled: true,
    apiKey: "sample%2Bkey%3D",
    baseUrl: "https://example.test/kdic",
    fetchImpl: async (url) => {
      capturedUrl = url;
      return kdicResponse([{
        fnccmpNm: "국민은행(주)",
        fncsecDscdNm: "은행",
        cttpc: "1588-9999, 1599-9999",
        hmpgUrladr: "https://www.kbstar.com",
        isrgTgtYn: "Y",
      }]);
    },
  });

  assert.equal(capturedUrl.pathname.endsWith("/getInsurgTrgetFnltInfoList"), true);
  assert.equal(capturedUrl.searchParams.get("ServiceKey"), "sample+key=");
  assert.equal(capturedUrl.searchParams.get("numOfRows"), "1000");
  assert.deepEqual(companies[0].phones, ["15889999", "15999999"]);
});

test("전화번호 직접 일치와 로컬 기관명 보강 근거를 구분한다", async () => {
  const config = {
    enabled: true,
    apiKey: "test-key",
    fetchImpl: async () => kdicResponse([{
      fnccmpNm: "국민은행(주)",
      fncsecDscdNm: "은행",
      cttpc: "1588-9999",
      isrgTgtYn: "Y",
    }]),
  };

  const phoneMatch = await findKdicWhitelistEvidence({ phone: "1588-9999" }, config);
  assert.equal(phoneMatch.matched, true);
  assert.equal(phoneMatch.matchType, "phone");

  const companyMatch = await findKdicWhitelistEvidence({
    phone: "02-0000-0000",
    companyName: "KB국민은행",
  }, config);
  assert.equal(companyMatch.matched, true);
  assert.equal(companyMatch.matchType, "institution");
});
