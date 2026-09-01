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

function backendApi(apiKey: string, graphConfig: Neo4jConfig, databaseConfig: Text2SqlConfig): Plugin {
  return {
    name: 'ansim-backend-api',
    configureServer(server) {
      // vite.config 는 .vite-temp 로 번들되므로 상대 경로가 깨진다.
      // 프로젝트 root(frontend/) 기준으로 절대 경로를 만든다.
      const handlerPath = pathToFileURL(resolve(server.config.root, '../backend/agents/4-intent-analysis/agent.js')).href

      server.middlewares.use('/api/intent', async (req, res) => {
        res.setHeader('Content-Type', 'application/json')

        if (req.method !== 'POST') {
          res.statusCode = 405
          return res.end(JSON.stringify({ error: 'POST only' }))
        }
        if (!apiKey) {
          res.statusCode = 500
          return res.end(JSON.stringify({ error: 'GEMINI_API_KEY가 루트 .env에 없습니다' }))
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
// 그래서 개발 서버(Node)가 대신 호출해 결과만 같은 origin 으로 돌려준다. API 키 불필요.
function stockQuoteApi(): Plugin {
  return {
    name: 'ansim-stock-quote-api',
    configureServer(server) {
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

          const quotes = await Promise.all(symbols.map(async (symbol) => {
            try {
              const r = await fetch(
                `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
                { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' } },
              )
              if (!r.ok) throw new Error(`upstream ${r.status}`)
              const data = await r.json() as any
              const meta = data?.chart?.result?.[0]?.meta
              const price = meta?.regularMarketPrice
              const prevClose = meta?.chartPreviousClose ?? meta?.previousClose
              if (typeof price !== 'number' || typeof prevClose !== 'number') throw new Error('no data')
              return { symbol, ok: true, price, changePct: ((price - prevClose) / prevClose) * 100 }
            } catch (e) {
              return { symbol, ok: false, error: (e as Error).message }
            }
          }))

          res.statusCode = 200
          res.end(JSON.stringify({ quotes, fetchedAt: Date.now() }))
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
      thecheatMockApi(),
      riskScoreApi(),
      stockQuoteApi(),
      fscApi(env.FSC_API_KEY),
    ],
  }
})
