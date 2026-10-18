// The /api/* Worker (ARCHITECTURE.md). Every other path is served from the built app's static assets.
import { deviceFor } from './auth'
import { getState, postResult, postSeeds, type ChildRequest } from './child'
import { error, json } from './http'

export interface Env {
  ASSETS: Fetcher
  DB: D1Database
}

/** Child routes; every one needs the iPad's device key (SPEC §2). */
const CHILD_ROUTES: Record<string, (req: ChildRequest) => Promise<Response>> = {
  'GET /api/state': getState,
  'POST /api/seeds': postSeeds,
  'POST /api/results': postResult,
}

/** The Worker's logic, with the clock passed in so tests can fix it. */
export async function handle(request: Request, env: Env, now: Date): Promise<Response> {
  const url = new URL(request.url)
  const { pathname } = url
  if (pathname === '/api/health') return json(200, { ok: true })
  if (pathname !== '/api' && !pathname.startsWith('/api/')) return env.ASSETS.fetch(request)

  const route = CHILD_ROUTES[`${request.method} ${pathname}`]
  if (!route) return error(404, 'not_found')
  const device = await deviceFor(request, env.DB)
  if (device === null) return error(401, 'unauthorized')
  try {
    return await route({ request, url, db: env.DB, device, now })
  } catch (e) {
    // Every error body is { error: code }, even an unexpected one (worker/http.ts).
    console.error(e)
    return error(500, 'server')
  }
}

export default {
  fetch: (request, env) => handle(request as unknown as Request, env, new Date()),
} satisfies ExportedHandler<Env>
