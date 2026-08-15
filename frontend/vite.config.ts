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
      const handlerPath = pathToFileURL(resolve(server.config.root, '../backend/intent.js')).href

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
          const { handleIntent } = await import(handlerPath)
          const result = await handleIntent(body, apiKey)

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
// 실제 더치트 API는 기관 발급 전용이므로 MVP용 임의 데이터셋으로 대체한다.
function thecheatMockApi(): Plugin {
  type Entry = { reportCount: number; scamTypes: string[]; lastReported: string }
  const BLACKLIST: Record<string, Entry> = {
    "01012345678": { reportCount: 14, scamTypes: ["기관사칭", "보이스피싱"], lastReported: "2025-11-03" },
    "01098765432": { reportCount: 6,  scamTypes: ["대출사기"],              lastReported: "2025-10-28" },
    "07012341234": { reportCount: 29, scamTypes: ["보이스피싱", "기관사칭"], lastReported: "2025-11-15" },
    "01055556666": { reportCount: 3,  scamTypes: ["스미싱"],                lastReported: "2025-09-14" },
    "01099990000": { reportCount: 11, scamTypes: ["투자사기"],              lastReported: "2025-11-01" },
    "1104421783":  { reportCount: 7,  scamTypes: ["보이스피싱"],            lastReported: "2025-10-10" },
    "1566XXXX":    { reportCount: 2,  scamTypes: ["기관사칭"],              lastReported: "2025-08-22" },
    "kb-safe.com":      { reportCount: 31, scamTypes: ["피싱사이트"],       lastReported: "2025-11-20" },
    "shinhan-auth.net": { reportCount: 18, scamTypes: ["피싱사이트"],       lastReported: "2025-11-12" },
    "hana-secure.co":   { reportCount: 9,  scamTypes: ["피싱사이트"],       lastReported: "2025-10-30" },
    "woori-verify.com": { reportCount: 24, scamTypes: ["피싱사이트"],       lastReported: "2025-11-18" },
    "bank-confirm.net": { reportCount: 15, scamTypes: ["피싱사이트", "스미싱"], lastReported: "2025-11-05" },
    "secure-login.kr":  { reportCount: 42, scamTypes: ["피싱사이트"],       lastReported: "2025-11-22" },
    "kbstar-verify.com":{ reportCount: 8,  scamTypes: ["피싱사이트"],       lastReported: "2025-10-15" },
  }

  function lookup(query: string): Entry | null {
    const clean = query.replace(/[-\s]/g, "")
    // 숫자번호: 6자리 이상일 때만 매칭 (짧은 입력의 오탐 방지)
    if (/^\d+$/.test(clean) && clean.length >= 6) {
      return BLACKLIST[clean] ?? null
    }
    // 도메인: 점(.)이 포함된 경우에만 매칭
    if (query.includes(".")) {
      const lower = query.toLowerCase()
      for (const [k, v] of Object.entries(BLACKLIST)) {
        if (k.includes(".") && lower.includes(k)) return v
      }
    }
    return null
  }

  return {
    name: 'thecheat-mock-api',
    configureServer(server) {
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
          const hit = lookup(String(query ?? ''))
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
    ],
    // 사용하지 않는 envFrontend 변수를 최소한으로 참조해 lint 경고 방지
    define: {
      __FSC_KEY_LOADED__: JSON.stringify(!!envFrontend.VITE_FSC_API_KEY),
    },
  }
})
