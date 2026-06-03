import { config } from '../config'

export function corsHeaders(origin: string | null): HeadersInit {
  const allowed = config.corsOrigins
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
  if (origin && (allowed.includes('*') || allowed.some(o => origin === o || origin.startsWith(o)))) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Credentials'] = 'true'
  }
  else if (allowed.includes('*')) {
    headers['Access-Control-Allow-Origin'] = '*'
  }
  return headers
}

export function withCors(response: Response, origin: string | null): Response {
  const headers = new Headers(response.headers)
  for (const [k, v] of Object.entries(corsHeaders(origin)))
    headers.set(k, v)
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
