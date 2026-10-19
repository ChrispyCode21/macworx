// Parent access (SPEC §6.9): the Worker checks the Cloudflare Access token on every parent request itself.
// ctx.access isn't passed to Workers that serve static assets, so this reads Cf-Access-Jwt-Assertion and
// verifies it against the team's signing keys. Anything missing or wrong means no access (fails closed).

export interface AccessEnv {
  /** e.g. chrispycode21.cloudflareaccess.com */
  ACCESS_TEAM_DOMAIN?: string
  /** The Access application's audience (AUD) tag. */
  ACCESS_AUD?: string
}

type Jwk = JsonWebKey & { kid: string }
export type CertsFetcher = (url: string) => Promise<{ keys: Jwk[] }>

export const fetchCertsFromCloudflare: CertsFetcher = async (url) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Access certs: ${response.status}`)
  return response.json()
}

/** Keys are kept for an hour; an unknown key id refetches at most once a minute, so forged tokens can't. */
const KEYS_TTL_MS = 60 * 60 * 1000
const REFETCH_GAP_MS = 60 * 1000
const CLOCK_LEEWAY_S = 60

const cache = new Map<string, { keys: Map<string, CryptoKey>; fetchedAt: number }>()

/** For tests: forget cached keys. */
export function clearAccessKeys() {
  cache.clear()
}

async function keyFor(team: string, kid: string, now: number, fetchCerts: CertsFetcher) {
  const cached = cache.get(team)
  const fresh = cached && now - cached.fetchedAt < KEYS_TTL_MS
  if (fresh && cached.keys.has(kid)) return cached.keys.get(kid)!
  if (fresh && now - cached.fetchedAt < REFETCH_GAP_MS) return null

  const { keys } = await fetchCerts(`https://${team}/cdn-cgi/access/certs`)
  const imported = new Map<string, CryptoKey>()
  for (const jwk of keys) {
    if (jwk.kty !== 'RSA' || !jwk.kid) continue
    const { kid: id, ...material } = jwk
    imported.set(
      id,
      await crypto.subtle.importKey('jwk', material, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, [
        'verify',
      ]),
    )
  }
  cache.set(team, { keys: imported, fetchedAt: now })
  return imported.get(kid) ?? null
}

function base64urlBytes(text: string): Uint8Array {
  const base64 = text
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(text.length / 4) * 4, '=')
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

function base64urlJson(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(new TextDecoder().decode(base64urlBytes(text)))
  } catch {
    return null
  }
}

/** The signed-in parent's email if the request carries a valid Access token for this app, else null. */
export async function parentEmail(
  request: Request,
  env: AccessEnv,
  now: Date,
  fetchCerts: CertsFetcher = fetchCertsFromCloudflare,
): Promise<string | null> {
  const team = env.ACCESS_TEAM_DOMAIN
  const audience = env.ACCESS_AUD
  if (!team || !audience) return null
  const token = request.headers.get('Cf-Access-Jwt-Assertion')
  const parts = token?.split('.')
  if (!parts || parts.length !== 3) return null

  const header = base64urlJson(parts[0])
  const payload = base64urlJson(parts[1])
  if (!header || !payload || header.alg !== 'RS256' || typeof header.kid !== 'string') return null

  const key = await keyFor(team, header.kid, now.getTime(), fetchCerts)
  if (!key) return null
  const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, base64urlBytes(parts[2]), signed)
  if (!valid) return null

  const seconds = now.getTime() / 1000
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud]
  const claimsOk =
    payload.iss === `https://${team}` &&
    audiences.includes(audience) &&
    typeof payload.exp === 'number' &&
    payload.exp + CLOCK_LEEWAY_S > seconds &&
    (payload.nbf === undefined ||
      (typeof payload.nbf === 'number' && payload.nbf - CLOCK_LEEWAY_S <= seconds)) &&
    typeof payload.email === 'string' &&
    payload.email.length > 0
  return claimsOk ? (payload.email as string) : null
}
