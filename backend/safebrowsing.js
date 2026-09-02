// Google Safe Browsing API(Lookup API v4) 조회 — 서버에서만 호출한다.
// 문자 링크(IncomingMessage)·URL 검증(Verify) 양쪽이 이 모듈 하나를 프록시로 거친다.
// 룰 베이스(IP 직접접속·화이트리스트·더치트 목업)만으로는 "아직 목록에 없는 새 피싱 URL"을
// 못 잡기 때문에, 구글이 실시간으로 수집하는 실제 악성 URL DB와 대조하는 단계로 보강한다.

export async function checkUrlThreat(url, apiKey) {
  if (!apiKey || !url) return null;
  try {
    const res = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client: { clientId: "ansim-ai", clientVersion: "1.0.0" },
          threatInfo: {
            threatTypes: [
              "MALWARE",
              "SOCIAL_ENGINEERING",
              "UNWANTED_SOFTWARE",
              "POTENTIALLY_HARMFUL_APPLICATION",
            ],
            platformTypes: ["ANY_PLATFORM"],
            threatEntryTypes: ["URL"],
            threatEntries: [{ url }],
          },
        }),
      },
    );
    if (!res.ok) return null; // 키 미등록·쿼터 초과 등 — 호출부는 null을 "판정 불가"로 처리한다
    const json = await res.json();
    const matches = json?.matches;
    if (!matches?.length) return { threat: false };
    return { threat: true, threatTypes: [...new Set(matches.map((m) => m.threatType))] };
  } catch {
    return null;
  }
}
