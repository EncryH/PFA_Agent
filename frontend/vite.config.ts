import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// 개발 서버에서 /api/intent 를 backend/ 로 넘긴다.
// API 키를 브라우저 번들에 넣지 않기 위한 프록시 — 키는 Node 프로세스에만 존재한다.
type Neo4jConfig = {
  enabled?: string
  uri?: string
  username?: string
  password?: string
  database?: string
  timeoutMs?: string
}

type Text2SqlConfig = {
  enabled?: string
  connectionString?: string
  timeoutMs?: string
}

type NaverSearchConfig = {
  enabled?: string
  clientId?: string
  clientSecret?: string
  baseUrl?: string
  timeoutMs?: string
}

type KdicApiConfig = {
  enabled?: string
  apiKey?: string
  baseUrl?: string
  timeoutMs?: string
}

function backendApi(apiKey: string, graphConfig: Neo4jConfig, databaseConfig: Text2SqlConfig): Plugin {
  return {
    name: 'ansim-backend-api',
    configureServer(server) {
      // vite.config 는 .vite-temp 로 번들되므로 상대 경로가 깨진다.
      // 프로젝트 root(frontend/) 기준으로 절대 경로를 만든다.
      const handlerPath = pathToFileURL(resolve(server.config.root, '../backend/agents/3-intent-analysis/agent.js')).href

      server.middlewares.use('/api/intent', async (req, res) => {
        res.setHeader('Content-Type', 'application/json')

        if (req.method !== 'POST') {
          res.statusCode = 405
          return res.end(JSON.stringify({ error: 'POST only' }))
        }
        try {
          const chunks: Buffer[] = []
          for await (const c of req) chunks.push(c as Buffer)
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')

          // backend/ 수정 후에는 dev 서버를 재시작해야 반영된다.
          // (Node ESM 캐시는 프로세스 단위라 쿼리 무효화로는 중첩 import 까지 못 지운다)
          const { runIntentAnalysisAgent } = await import(handlerPath)
          const result = await runIntentAnalysisAgent(body, {
            apiKey,
            graphConfig,
            databaseConfig,
          })

          res.statusCode = 200
          res.end(JSON.stringify(result))
        } catch (e) {
          console.error('[ansim-backend-api]', e)
          res.statusCode = 502
          res.end(JSON.stringify({ error: (e as Error).message }))
        }
      })
    },
  }
}

// 더치트 mock API — POST /api/thecheat/check { query: string }
// 데이터·조회 로직은 1층 상대방 검증 에이전트(backend/agents/1-counterparty-verification)에 있다.
// Verify.tsx 화면과 실제 송금 시 1층 판정이 서로 다른 데이터를 보면 "검증 땐 안전했는데
// 송금은 막혔다" 같은 불일치가 생기므로, 여기서는 그 모듈을 그대로 불러다 감싸기만 한다.
function thecheatMockApi(): Plugin {
  return {
    name: 'thecheat-mock-api',
    configureServer(server) {
      const handlerPath = pathToFileURL(resolve(server.config.root, '../backend/agents/1-counterparty-verification/rules/blacklist.js')).href
      server.middlewares.use('/api/thecheat/check', async (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        if (req.method !== 'POST') {
          res.statusCode = 405
          return res.end(JSON.stringify({ error: 'POST only' }))
        }
        try {
          const chunks: Buffer[] = []
          for await (const c of req) chunks.push(c as Buffer)
          const { query } = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
          const { matchBlacklist } = await import(handlerPath)
          const hit = matchBlacklist(String(query ?? ''))
          res.statusCode = 200
          res.end(JSON.stringify({
            data: hit
              ? { found: true,  ...hit }
              : { found: false, reportCount: 0, scamTypes: [], lastReported: '' },
          }))
        } catch (e) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: (e as Error).message }))
        }
      })
    },
  }
}

// 1단계 상대방 전화번호 검증 — POST /api/counterparty/phone { phone: string }
// 예금보험공사·공식 연락처·위험번호 목록을 먼저 확인하고, 미확인 번호만 NAVER 웹문서로 보완한다.
// 전화번호와 인증 키는 브라우저 번들·서버 로그에 남기지 않는다.
function counterpartyPhoneApi(config: NaverSearchConfig, kdicConfig: KdicApiConfig): Plugin {
  return {
    name: 'ansim-counterparty-phone-api',
    configureServer(server) {
      const handlerPath = pathToFileURL(resolve(
        server.config.root,
        '../backend/agents/1-counterparty-verification/agent.js',
      )).href

      server.middlewares.use('/api/counterparty/phone', async (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')

        if (req.method !== 'POST') {
          res.statusCode = 405
          return res.end(JSON.stringify({ error: 'POST only' }))
        }
        try {
          const chunks: Buffer[] = []
          let size = 0
          for await (const chunk of req) {
            const buffer = chunk as Buffer
            size += buffer.length
            if (size > 4096) throw new Error('REQUEST_TOO_LARGE')
            chunks.push(buffer)
          }
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
          const { verifyPhoneWithNaverSearch } = await import(handlerPath)
          const result = await verifyPhoneWithNaverSearch(body.phone, {
            enabled: config.enabled,
            clientId: config.clientId,
            clientSecret: config.clientSecret,
            baseUrl: config.baseUrl,
            timeoutMs: config.timeoutMs,
            kdicConfig,
          })

          res.statusCode = 200
          res.end(JSON.stringify({ result }))
        } catch (error) {
          const code = (error as Error & { code?: string }).code
          if (code === 'INVALID_PHONE') {
            res.statusCode = 400
            return res.end(JSON.stringify({ error: (error as Error).message }))
          }
          if ((error as Error).message === 'REQUEST_TOO_LARGE') {
            res.statusCode = 413
            return res.end(JSON.stringify({ error: '요청이 너무 큽니다' }))
          }
          console.error('[ansim-counterparty-phone-api]', (error as Error).message)
          res.statusCode = 502
          res.end(JSON.stringify({ error: '전화번호 공개 웹문서 검색을 완료하지 못했습니다' }))
        }
      })
    },
  }
}

function riskScoreApi(): Plugin {
  return {
    name: 'ansim-risk-score-api',
    configureServer(server) {
      const handlerPath = pathToFileURL(resolve(server.config.root, '../backend/risk.js')).href
      server.middlewares.use('/api/risk-score', async (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        if (req.method !== 'POST') {
          res.statusCode = 405
          return res.end(JSON.stringify({ error: 'POST only' }))
        }
        try {
          const chunks: Buffer[] = []
          for await (const c of req) chunks.push(c as Buffer)
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
          const { scoreRisk } = await import(handlerPath)
          res.statusCode = 200
          res.end(JSON.stringify(scoreRisk(body)))
        } catch (e) {
          console.error('[ansim-risk-score-api]', e)
          res.statusCode = 502
          res.end(JSON.stringify({ error: (e as Error).message }))
        }
      })
    },
  }
}

// 주식 시세 프록시 — GET /api/stocks?symbols=005930.KS,^KS11,...
// Yahoo Finance 차트 API는 CORS 헤더가 없어 브라우저에서 직접 호출이 막힌다.
// 실제 조회는 backend/stocks.js에 두어 Vercel 함수와 같은 구현을 공유한다.
function stockQuoteApi(): Plugin {
  return {
    name: 'ansim-stock-quote-api',
    configureServer(server) {
      const handlerPath = pathToFileURL(resolve(server.config.root, '../backend/stocks.js')).href
      server.middlewares.use('/api/stocks', async (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        try {
          const url = new URL(req.url ?? '', 'http://localhost')
          const symbols = (url.searchParams.get('symbols') ?? '')
            .split(',').map((s) => s.trim()).filter(Boolean)
          if (!symbols.length) {
            res.statusCode = 400
            return res.end(JSON.stringify({ error: 'symbols query param required' }))
          }

          const { fetchStockQuotes } = await import(handlerPath)
          const result = await fetchStockQuotes(symbols)
          res.statusCode = 200
          res.end(JSON.stringify(result))
        } catch (e) {
          console.error('[ansim-stock-quote-api]', e)
          res.statusCode = 502
          res.end(JSON.stringify({ error: (e as Error).message }))
        }
      })
    },
  }
}

// 금융위원회 금융회사기본정보 OpenAPI 프록시 — GET /api/fsc/verify?name=국민은행
// 데이터포털 서비스키를 브라우저에 노출하지 않으려고(GEMINI_API_KEY와 같은 이유) 서버가 대신 호출한다.
// 실제 조회 로직은 backend/fsc.js — verify.ts·callscreen.ts 양쪽이 여기로 통일해서 부른다.
function fscApi(apiKey: string): Plugin {
  return {
    name: 'ansim-fsc-api',
    configureServer(server) {
      const handlerPath = pathToFileURL(resolve(server.config.root, '../backend/fsc.js')).href
      server.middlewares.use('/api/fsc/verify', async (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        try {
          const url = new URL(req.url ?? '', 'http://localhost')
          const name = url.searchParams.get('name') ?? ''
          if (!name) {
            res.statusCode = 400
            return res.end(JSON.stringify({ error: 'name query param required' }))
          }
          const { lookupFscInstitution } = await import(handlerPath)
          const items = await lookupFscInstitution(name, apiKey)
          res.statusCode = 200
          res.end(JSON.stringify({ items }))
        } catch (e) {
          console.error('[ansim-fsc-api]', e)
          res.statusCode = 502
          res.end(JSON.stringify({ error: (e as Error).message }))
        }
      })
    },
  }
}

// KISA(한국인터넷진흥원) 피싱사이트 목록 → Google Safe Browsing 프록시 — POST /api/safe-browsing/check { url }
// KISA는 로컬 CSV 스냅샷이라 키·네트워크 없이 먼저 보고, 안 걸리면 Google로 넘어간다.
// 데이터포털 서비스키와 같은 이유로(브라우저 노출·쿼터 남용 방지) 서버가 대신 호출한다.
// 실제 조회 로직은 backend/kisaPhishing.js·backend/safebrowsing.js — verify.ts 의
// verifyUrl()이 여기로 부른다. frontend/api/safe-browsing/check.js(운영 배포용)와
// 로직을 반드시 같이 맞춘다 — 이 프로젝트는 개발 서버용 프록시를 여기, 운영용은 그쪽에 따로 둔다.
function safeBrowsingApi(apiKey: string): Plugin {
  return {
    name: 'ansim-safe-browsing-api',
    configureServer(server) {
      const safeBrowsingPath = pathToFileURL(resolve(server.config.root, '../backend/safebrowsing.js')).href
      const kisaPath = pathToFileURL(resolve(server.config.root, '../backend/kisaPhishing.js')).href
      server.middlewares.use('/api/safe-browsing/check', async (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        if (req.method !== 'POST') {
          res.statusCode = 405
          return res.end(JSON.stringify({ error: 'POST only' }))
        }
        try {
          const chunks: Buffer[] = []
          let size = 0
          for await (const chunk of req) {
            const buffer = chunk as Buffer
            size += buffer.length
            if (size > 8192) throw new Error('REQUEST_TOO_LARGE')
            chunks.push(buffer)
          }
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
          const target = String(body.url ?? '').trim()
          if (!target) {
            res.statusCode = 400
            return res.end(JSON.stringify({ error: 'url required' }))
          }
          const { checkKisaPhishing } = await import(kisaPath)
          const kisa = checkKisaPhishing(target)
          if (kisa?.threat) {
            res.statusCode = 200
            return res.end(JSON.stringify({ result: { threat: true, source: 'kisa' } }))
          }

          const { checkUrlThreat } = await import(safeBrowsingPath)
          const google = await checkUrlThreat(target, apiKey)
          if (google?.threat) {
            res.statusCode = 200
            return res.end(JSON.stringify({ result: { ...google, source: 'google' } }))
          }

          if (kisa?.shortenerHost) {
            res.statusCode = 200
            return res.end(JSON.stringify({
              result: { threat: false, source: 'kisa', shortenerHost: true, knownBadPaths: kisa.knownBadPaths },
            }))
          }

          res.statusCode = 200
          res.end(JSON.stringify({ result: google }))
        } catch (e) {
          if ((e as Error).message === 'REQUEST_TOO_LARGE') {
            res.statusCode = 413
            return res.end(JSON.stringify({ error: '요청이 너무 큽니다' }))
          }
          console.error('[ansim-safe-browsing-api]', e)
          res.statusCode = 502
          res.end(JSON.stringify({ error: (e as Error).message }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // 루트 .env (저장소 최상위) — GEMINI_API_KEY·FSC_API_KEY 등 서버 전용 키를 여기 한 곳에서 관리한다.
  const env = loadEnv(mode, '..', '')

  return {
    plugins: [
      react(),
      tailwindcss(),
      backendApi(env.GEMINI_API_KEY, {
        enabled: env.NEO4J_ENABLED,
        uri: env.NEO4J_URI,
        username: env.NEO4J_USERNAME,
        password: env.NEO4J_PASSWORD,
        database: env.NEO4J_DATABASE,
        timeoutMs: env.NEO4J_TIMEOUT_MS,
      }, {
        enabled: env.TEXT2SQL_ENABLED,
        connectionString: env.SUPABASE_DATABASE_URL || env.DATABASE_URL,
        timeoutMs: env.TEXT2SQL_TIMEOUT_MS,
      }),
      counterpartyPhoneApi({
        enabled: env.NAVER_SEARCH_ENABLED,
        clientId: env.NAVER_API_HUB_CLIENT_ID,
        clientSecret: env.NAVER_API_HUB_CLIENT_SECRET,
        baseUrl: env.NAVER_SEARCH_BASE_URL,
        timeoutMs: env.NAVER_SEARCH_TIMEOUT_MS,
      }, {
        enabled: env.KDIC_API_ENABLED,
        apiKey: env.KDIC_API_KEY,
        baseUrl: env.KDIC_API_URL,
        timeoutMs: env.KDIC_API_TIMEOUT_MS,
      }),
      thecheatMockApi(),
      riskScoreApi(),
      stockQuoteApi(),
      fscApi(env.FSC_API_KEY),
      safeBrowsingApi(env.GOOGLE_SAFE_BROWSING_API_KEY),
    ],
  }
})
