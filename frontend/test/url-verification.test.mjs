import test from "node:test";
import assert from "node:assert/strict";
import { verifyUrl } from "../src/shared/verify.ts";

test("URL rules inspect the hostname and require the exact HTTPS protocol", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => String(input).includes("safe-browsing")
    ? Response.json({ result: null })
    : Response.json({ data: { found: false, reportCount: 0, scamTypes: [], lastReported: "" } });

  try {
    assert.equal((await verifyUrl("https://example.com/secure-login?next=bank-confirm")).status, "caution");
    assert.equal((await verifyUrl("https://kbstar.com/help?next=secure-login")).status, "safe");
    assert.equal((await verifyUrl("https://secure-login.example.com")).status, "danger");
    assert.equal((await verifyUrl("httpsx://kbstar.com")).status, "caution");
    assert.equal((await verifyUrl("192.168.0.1/login")).status, "danger");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
