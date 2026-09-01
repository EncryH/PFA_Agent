// 금융위원회_금융회사기본정보 OpenAPI(data.go.kr) 조회 — 서버에서만 호출한다.
// 데이터포털 서비스키는 브라우저에 노출하지 않는 게 원칙이라(사용량 제한이 걸려있어
// 남용 위험도 있다), GEMINI_API_KEY와 같은 방식으로 백엔드 프록시를 거치게 한다.
// verify.ts(상대방 검증 화면)·callscreen.ts(전화 수신 화면) 양쪽이 따로 갖고 있던
// 호출 로직을 여기 하나로 합쳤다.

export async function lookupFscInstitution(name, apiKey) {
  if (!apiKey || !name) return null;
  try {
    const url =
      `https://apis.data.go.kr/1160100/service/GetFnCoBasiInfoService/getFnCoOutl` +
      `?serviceKey=${apiKey}&resultType=json&numOfRows=5&pageNo=1&fncoNm=${encodeURIComponent(name)}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json?.OpenAPI_ServiceResponse) return null; // 인증 실패·서비스 중단 등 에러 포맷
    const items = json?.response?.body?.items?.item;
    if (!items) return null;
    const list = Array.isArray(items) ? items : [items];
    return list.map((it) => ({ fncoNm: it.fncoNm, corpRegNo: it.crno }));
  } catch {
    return null;
  }
}
