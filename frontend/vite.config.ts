import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// 개발 서버에서 /api/intent 를 backend/ 로 넘긴다.
// API 키를 브라우저 번들에 넣지 않기 위한 프록시 — 키는 Node 프로세스에만 존재한다.
function backendApi(apiKey: string): Plugin {
  return {
    name: 'ansim-backend-api',
    configureServer(server) {
      // vite.config 는 .vite-temp 로 번들되므로 상대 경로가 깨진다.
      // 프로젝트 root(frontend/) 기준으로 절대 경로를 만든다.
      const handlerPath = pathToFileURL(resolve(server.config.root, '../backend/agents/intent-analysis/agent.js')).href

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
          const result = await runIntentAnalysisAgent(body, { apiKey })

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
// 데이터·조회 로직은 backend/thecheat.js 에 있다 — Vercel 서버리스 함수(frontend/api/thecheat/check.js)와
// 같은 모듈을 쓰기 때문에, dev 서버 프록시인 여기서는 그 모듈을 불러다 감싸기만 한다.
function thecheatMockApi(): Plugin {
  return {
    name: 'thecheat-mock-api',
    configureServer(server) {
      const handlerPath = pathToFileURL(resolve(server.config.root, '../backend/thecheat.js')).href
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
          const { lookupThecheat } = await import(handlerPath)
          const hit = lookupThecheat(String(query ?? ''))
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
// 실제 조회 로직은 backend/stocks.js — Vercel 서버리스 함수(frontend/api/stocks.js)와 공유한다.
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

export default defineConfig(({ mode }) => {
  // 루트 .env (저장소 최상위) — GEMINI_API_KEY 등 서버 전용 키
  const env = loadEnv(mode, '..', '')
  // frontend/.env — VITE_* 브라우저 노출 키 (FSC_API_KEY 등)
  const envFrontend = loadEnv(mode, '.', 'VITE_')

  return {
    // envDir 기본값(프로젝트 루트 = frontend/)으로 VITE_ 변수를 브라우저에 노출
    plugins: [
      react(),
      tailwindcss(),
      backendApi(env.GEMINI_API_KEY),
      thecheatMockApi(),
      riskScoreApi(),
      stockQuoteApi(),
    ],
    // 사용하지 않는 envFrontend 변수를 최소한으로 참조해 lint 경고 방지
    define: {
      __FSC_KEY_LOADED__: JSON.stringify(!!envFrontend.VITE_FSC_API_KEY),
    },
  }
})
