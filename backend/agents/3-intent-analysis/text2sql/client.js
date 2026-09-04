// postgres 는 정적 import 로 두지 않는다. 서버리스 배포에서 이 파일은 frontend/
// 밖(backend/)에 있고, Node 는 import 하는 파일 위치에서 위로 올라가며
// node_modules 를 찾기 때문에 frontend/node_modules/postgres 를 영원히 못 찾는다.
// 정적 import 면 모듈 로딩 단계에서 그대로 터져 text2sql 과 무관한 /api/intent
// 전체가 500 으로 죽는다.
//
// 그래서 두 단계로 구한다.
//   1) 호출자가 넘겨준 postgresFactory — frontend/api/intent.js 처럼 패키지를
//      정상적으로 resolve 할 수 있는 쪽에서 주입한다. 배포 환경의 정상 경로다.
//   2) 없으면 동적 import — 로컬 dev 처럼 backend/node_modules 가 있는 환경.
//      이마저 실패하면 거래 패턴 조회만 "비활성"으로 내려가고 본류는 살아 있다.
let importedFactory = null;
let importFailed = false;

async function loadPostgres(injected) {
  if (typeof injected === "function") return injected;
  if (importedFactory || importFailed) return importedFactory;
  try {
    importedFactory = (await import("postgres")).default;
  } catch (error) {
    importFailed = true;
    console.warn(`[text2sql] postgres 모듈을 불러오지 못해 거래 패턴 조회를 건너뜁니다: ${error.message}`);
  }
  return importedFactory;
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

  const postgres = await loadPostgres(config.postgresFactory);
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
