// The /api/* Worker (ARCHITECTURE.md). Every other path is served from the built app's static assets.
export interface Env {
  ASSETS: Fetcher
  DB: D1Database
}

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url)
    if (pathname === '/api/health') return Response.json({ ok: true })
    if (pathname === '/api' || pathname.startsWith('/api/'))
      return Response.json({ error: 'Not found' }, { status: 404 })
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
