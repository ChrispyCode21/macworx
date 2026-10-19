// The /api/* Worker (ARCHITECTURE.md). Every other path is served from the built app's static assets.
import { fetchCertsFromCloudflare, parentEmail, type AccessEnv, type CertsFetcher } from './access'
import { deviceFor } from './auth'
import { getState, postResult, postSeeds, type ChildRequest } from './child'
import { error, json } from './http'
import { postPair } from './pair'
import { PARENT_ROUTES } from './parent'

export interface Env extends AccessEnv {
  ASSETS: Fetcher
  DB: D1Database
  /** Pairing tries per address (SPEC §6.9). Missing means pairing is refused: the guard never goes quietly. */
  PAIR_LIMITER?: RateLimit
}

/** Child routes; every one needs the iPad's device key (SPEC §2). */
const CHILD_ROUTES: Record<string, (req: ChildRequest) => Promise<Response>> = {
  'GET /api/state': getState,
  'POST /api/seeds': postSeeds,
  'POST /api/results': postResult,
}

const isParentPath = (pathname: string) => pathname === '/api/parent' || pathname.startsWith('/api/parent/')

/** The Worker's logic, with the clock (and, for tests, the Access key source) passed in. */
export async function handle(
  request: Request,
  env: Env,
  now: Date,
  fetchCerts: CertsFetcher = fetchCertsFromCloudflare,
): Promise<Response> {
  const url = new URL(request.url)
  const { pathname } = url
  if (pathname === '/api/health') return json(200, { ok: true })
  if (pathname !== '/api' && !pathname.startsWith('/api/')) return env.ASSETS.fetch(request)

  try {
    // Parent routes: the Access token is checked before anything else, so even an unknown parent path is 401.
    if (isParentPath(pathname)) {
      const email = await parentEmail(request, env, now, fetchCerts)
      if (email === null) return error(401, 'unauthorized')
      for (const route of PARENT_ROUTES) {
        const match = route.method === request.method && route.pattern.exec(pathname)
        if (match)
          return await route.run({ request, url, db: env.DB, email, now, params: { ...match.groups } })
      }
      return error(404, 'not_found')
    }

    // The one write route with no key or token: the one-time code is the gate (CLAUDE.md, SPEC §6.9).
    if (request.method === 'POST' && pathname === '/api/pair')
      return await postPair({ request, db: env.DB, now, limiter: env.PAIR_LIMITER })

    const route = CHILD_ROUTES[`${request.method} ${pathname}`]
    if (!route) return error(404, 'not_found')
    const device = await deviceFor(request, env.DB)
    if (device === null) return error(401, 'unauthorized')
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
