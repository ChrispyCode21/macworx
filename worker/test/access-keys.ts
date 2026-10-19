// A stand-in for Cloudflare Access in tests: a real RSA key pair, its public key served as the team's
// certs, and tokens signed with it the way Access signs Cf-Access-Jwt-Assertion.
import type { CertsFetcher } from '../access'

export const TEAM = 'test-team.cloudflareaccess.com'
export const AUD = 'test-aud-tag'
export const KID = 'test-key-1'
/** A second key, as if Cloudflare rotated its signing keys. */
export const ROTATED_KID = 'test-key-2'

const newPair = async () =>
  (await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair
const pairs: Record<string, CryptoKeyPair> = { [KID]: await newPair(), [ROTATED_KID]: await newPair() }
const publicJwk = async (kid: string) => ({
  ...((await crypto.subtle.exportKey('jwk', pairs[kid].publicKey)) as JsonWebKey),
  kid,
})

/**
 * Serves test keys as the team's certs, and counts how often it's asked. `serve` decides what each call
 * returns: the key ids to serve, or an error to throw.
 */
export function testCerts(serve: (call: number) => string[] | Error = () => [KID]) {
  const calls: string[] = []
  const fetchCerts: CertsFetcher = async (url) => {
    calls.push(url)
    const kids = serve(calls.length)
    if (kids instanceof Error) throw kids
    return { keys: await Promise.all(kids.map(publicJwk)) }
  }
  return { fetchCerts, calls }
}

/** A certs response with one key the check can't use, next to a good one. */
export async function certsWithUnusableKey() {
  return [{ kty: 'RSA', kid: 'broken', n: 'not-a-modulus', e: 'AQAB' }, await publicJwk(KID)]
}

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
const b64urlJson = (value: unknown) => b64url(new TextEncoder().encode(JSON.stringify(value)))

/** A signed token; override any header or claim to make a bad one. */
export async function accessToken({
  header = {},
  claims = {},
  now = new Date('2026-10-17T12:00:00Z'),
}: {
  header?: Record<string, unknown>
  claims?: Record<string, unknown>
  now?: Date
} = {}): Promise<string> {
  const seconds = Math.floor(now.getTime() / 1000)
  const head = b64urlJson({ alg: 'RS256', kid: KID, typ: 'JWT', ...header })
  const body = b64urlJson({
    iss: `https://${TEAM}`,
    aud: [AUD],
    email: 'parent@example.com',
    iat: seconds,
    nbf: seconds,
    exp: seconds + 3600,
    ...claims,
  })
  const kid = typeof header.kid === 'string' && header.kid in pairs ? header.kid : KID
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    pairs[kid].privateKey,
    new TextEncoder().encode(`${head}.${body}`),
  )
  return `${head}.${body}.${b64url(new Uint8Array(signature))}`
}
