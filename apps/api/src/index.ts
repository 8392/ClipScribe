import './load-env'
import { mkdir } from 'node:fs/promises'
import { config } from './config'
import { corsHeaders, withCors } from './lib/cors'
import { jsonError } from './lib/errors'
import { handleAnalyze } from './routes/analyze'

await mkdir(config.tempDir, { recursive: true })

const server = Bun.serve({
  hostname: '0.0.0.0',
  port: config.port,
  async fetch(req) {
    const origin = req.headers.get('Origin')
    const url = new URL(req.url)

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }

    try {
      let res: Response
      if (url.pathname === '/health' && req.method === 'GET') {
        res = Response.json({
          ok: true,
          llmProvider: config.llm.provider,
          llmModel: config.llm.model,
          dashscopeConfigured: Boolean(config.llm.dashscopeApiKey),
          summaryLanguage: config.summaryLanguage,
          subtitleLang: config.subtitleLang,
        })
      }
      else if (url.pathname === '/api/analyze' && req.method === 'POST') {
        res = await handleAnalyze(req)
      }
      else {
        res = Response.json({ error: 'Not found' }, { status: 404 })
      }
      return withCors(res, origin)
    }
    catch (e) {
      return withCors(jsonError(e), origin)
    }
  },
})

console.log(`ClipScribe API listening on http://localhost:${server.port}`)
console.log(`LLM: ${config.llm.provider} / ${config.llm.model}`)
