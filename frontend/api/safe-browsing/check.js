import { checkUrlThreat } from "../../../backend/safebrowsing.js";
import { checkKisaPhishing } from "../../../backend/kisaPhishing.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const target = String(req.body?.url ?? "").trim();
  if (!target) return res.status(400).json({ error: "url required" });

  try {
    // KISA(한국인터넷진흥원) 국내 피싱사이트 목록을 먼저 본다 — 키·네트워크 호출이 필요
    // 없어 더 빠르고, 국내 금융기관 사칭 도메인에 특화돼 있다. 스냅샷이라 신규 사이트는
    // 못 잡을 수 있어, 여기서 안 걸리면 Google Safe Browsing으로 넓게 보강한다.
    const kisa = checkKisaPhishing(target);
    if (kisa?.threat) {
      return res.status(200).json({ result: { threat: true, source: "kisa" } });
    }

    const google = await checkUrlThreat(target, process.env.GOOGLE_SAFE_BROWSING_API_KEY);
    if (google?.threat) {
      return res.status(200).json({ result: { ...google, source: "google" } });
    }

    // 이 링크 자체는 확정된 위협이 아니지만, 같은 호스트에서 발급된 다른 단축 링크가
    // 이미 KISA에 신고된 적 있다 — "확인 불가"로 뭉개지 않고 그 사실을 그대로 알려준다.
    if (kisa?.shortenerHost) {
      return res.status(200).json({
        result: { threat: false, source: "kisa", shortenerHost: true, knownBadPaths: kisa.knownBadPaths },
      });
    }

    return res.status(200).json({ result: google });
  } catch (error) {
    console.error("[api/safe-browsing/check]", error);
    return res.status(502).json({ error: error.message });
  }
}
