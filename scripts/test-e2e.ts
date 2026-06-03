/**
 * 本地端到端测试：bun run scripts/test-e2e.ts [youtube-url]
 */
const api = process.env.API_URL || 'http://localhost:3000'
const url = process.argv[2] || 'https://www.youtube.com/watch?v=jNQXAC9IVRw'

console.log('Health...')
const health = await fetch(`${api}/health`).then(r => r.json())
console.log(health)

if (!health.dashscopeConfigured) {
  console.error('FAIL: DASHSCOPE_API_KEY not loaded. Create apps/api/.env')
  process.exit(1)
}

console.log('\nAnalyze:', url)
const t0 = Date.now()
const res = await fetch(`${api}/api/analyze`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url }),
})
const body = await res.json()
const elapsed = ((Date.now() - t0) / 1000).toFixed(1)

if (!res.ok) {
  console.error(`FAIL (${res.status}) in ${elapsed}s:`, body)
  process.exit(1)
}

console.log(`OK in ${elapsed}s`)
console.log('Title:', body.videoTitle)
console.log('Summary:', body.summary?.summary?.slice(0, 120), '...')
console.log('Key points:', body.summary?.keyPoints?.length)
console.log('Transcript chars:', body.transcript?.length)
console.log('Formats:', Object.keys(body.formats || {}))
