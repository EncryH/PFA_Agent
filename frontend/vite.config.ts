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

          // backend/ 는 Vite 감시 대상이 아니라 Node ESM 캐시에 남는다.
          // 쿼리로 캐시를 무효화해 서버 재시작 없이 수정이 반영되게 한다 (개발 전용).
          const { handleIntent } = await import(`${handlerPath}?t=${Date.now()}`)
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

export default defineConfig(({ mode }) => {
  // 세 번째 인자 '' → VITE_ 접두사 없는 변수까지 로드. 이 값은 Node 쪽에만 머문다.
  // envDir '..' → 저장소 루트의 .env 를 읽는다.
  const env = loadEnv(mode, '..', '')

  return {
    envDir: '..',
    plugins: [react(), tailwindcss(), backendApi(env.GEMINI_API_KEY)],
  }
})
