const DEFAULT_DATABASE = "neo4j";
const DEFAULT_TIMEOUT_MS = 1_500;
const CIRCUIT_BREAK_MS = 30_000;

let circuitOpenUntil = 0;

function booleanValue(value, fallback = true) {
  if (value === undefined || value === null || value === "") return fallback;
  return !["0", "false", "off", "no"].includes(String(value).toLowerCase());
}

export function toAuraHttpUrl(value = "") {
  const raw = String(value).trim().replace(/\/+$/, "");
  if (!raw) return "";

  if (/^(neo4j|bolt)(\+s|\+ssc)?:\/\//i.test(raw)) {
    const httpsUrl = raw.replace(/^(neo4j|bolt)(\+s|\+ssc)?:/i, "https:");
    const parsed = new URL(httpsUrl);
    return `https://${parsed.host}`;
  }

  if (/^https:\/\//i.test(raw)) return raw;
  throw new Error("NEO4J_URI_INVALID");
}

export function resolveNeo4jConfig(config = {}) {
  const password = config.password ?? process.env.NEO4J_PASSWORD ?? "";
  const uri = config.uri
    ?? process.env.NEO4J_URI
    ?? config.httpUrl
    ?? process.env.NEO4J_HTTP_URL
    ?? "";
  let httpUrl = "";
  try {
    httpUrl = toAuraHttpUrl(uri);
  } catch {
    httpUrl = "";
  }
  return {
    enabled: booleanValue(config.enabled ?? process.env.NEO4J_ENABLED, true)
      && Boolean(password)
      && Boolean(httpUrl),
    httpUrl,
    username: String(config.username ?? process.env.NEO4J_USERNAME ?? "neo4j"),
    password: String(password),
    database: String(config.database ?? process.env.NEO4J_DATABASE ?? DEFAULT_DATABASE),
    timeoutMs: Math.max(200, Number(config.timeoutMs ?? process.env.NEO4J_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS),
  };
}

export async function executeNeo4jQuery(statement, parameters = {}, inputConfig = {}, {
  bypassCircuitBreaker = false,
} = {}) {
  const config = resolveNeo4jConfig(inputConfig);
  if (!config.enabled) throw new Error("NEO4J_NOT_CONFIGURED");
  if (!bypassCircuitBreaker && Date.now() < circuitOpenUntil) {
    throw new Error("NEO4J_CIRCUIT_OPEN");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  const url = `${config.httpUrl}/db/${encodeURIComponent(config.database)}/query/v2`;
  const authorization = Buffer.from(`${config.username}:${config.password}`).toString("base64");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authorization}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        statement: String(statement).replace(/\s+/g, " ").trim(),
        parameters,
        maxExecutionTime: Math.max(1, Math.ceil(config.timeoutMs / 1000)),
        txMetadata: { app: "ansim-intent-analysis" },
      }),
      signal: controller.signal,
    });

    const body = await response.json().catch(() => ({}));
    const queryErrors = body.errors || (body.error ? [body.error] : []);
    if (!response.ok || queryErrors.length) {
      const detail = queryErrors[0]?.message || queryErrors[0]?.title || `HTTP ${response.status}`;
      throw new Error(`NEO4J_QUERY_FAILED: ${String(detail).slice(0, 240)}`);
    }

    const fields = body.data?.fields || [];
    const values = body.data?.values || [];
    circuitOpenUntil = 0;
    return values.map((row) => Object.fromEntries(fields.map((field, index) => [field, row[index]])));
  } catch (error) {
    circuitOpenUntil = Date.now() + CIRCUIT_BREAK_MS;
    if (error?.name === "AbortError") throw new Error("NEO4J_TIMEOUT");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function neo4jConnectionStatus(inputConfig = {}) {
  const config = resolveNeo4jConfig(inputConfig);
  return {
    enabled: config.enabled,
    database: config.database,
    circuit_open: Date.now() < circuitOpenUntil,
  };
}
