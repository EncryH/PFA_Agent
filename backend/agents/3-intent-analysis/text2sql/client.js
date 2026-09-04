// postgres 는 지연 로딩한다. 이 파일은 서버리스 배포에서 프론트와 다른 디렉터리
// 트리에 있어서 상단 정적 import 로 두면 패키지를 못 찾을 때 모듈 로딩 자체가
// 실패하고, text2sql 과 무관한 /api/intent 전체가 500 으로 죽는다.
// 개인 거래 패턴 조회는 부가 기능이므로, 못 불러오면 "비활성"으로만 내려간다.
let postgresFactory = null;
let postgresLoadFailed = false;

async function loadPostgres() {
  if (postgresFactory || postgresLoadFailed) return postgresFactory;
  try {
    postgresFactory = (await import("postgres")).default;
  } catch (error) {
    postgresLoadFailed = true;
    console.warn(`[text2sql] postgres 모듈을 불러오지 못해 거래 패턴 조회를 건너뜁니다: ${error.message}`);
  }
  return postgresFactory;
}

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

export async function getText2SqlClient(config = {}) {
  const resolved = resolveText2SqlConfig(config);
  if (!resolved.enabled || !resolved.connectionString) return { sql: null, config: resolved };

  const postgres = await loadPostgres();
  if (!postgres) return { sql: null, config: { ...resolved, enabled: false } };

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
