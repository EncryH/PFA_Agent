import postgres from "postgres";

let cachedClient = null;
let cachedConnectionString = "";

function enabled(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  return !["0", "false", "off", "no"].includes(String(value).trim().toLowerCase());
}

export function resolveText2SqlConfig(config = {}) {
  const connectionString = String(
    config.connectionString
      || process.env.SUPABASE_DATABASE_URL
      || process.env.DATABASE_URL
      || "",
  ).trim();
  return {
    enabled: enabled(config.enabled ?? process.env.TEXT2SQL_ENABLED, Boolean(connectionString)),
    connectionString,
    timeoutMs: Math.max(300, Number(config.timeoutMs ?? process.env.TEXT2SQL_TIMEOUT_MS) || 5_000),
  };
}

export function getText2SqlClient(config = {}) {
  const resolved = resolveText2SqlConfig(config);
  if (!resolved.enabled || !resolved.connectionString) return { sql: null, config: resolved };

  if (!cachedClient || cachedConnectionString !== resolved.connectionString) {
    cachedClient = postgres(resolved.connectionString, {
      max: 3,
      prepare: false,
      ssl: "require",
      connect_timeout: Math.max(1, Math.ceil(resolved.timeoutMs / 1_000)),
      idle_timeout: 20,
      max_lifetime: 60 * 30,
      onnotice: () => {},
    });
    cachedConnectionString = resolved.connectionString;
  }

  return { sql: cachedClient, config: resolved };
}

export async function closeText2SqlClient() {
  if (cachedClient) await cachedClient.end({ timeout: 2 });
  cachedClient = null;
  cachedConnectionString = "";
}
