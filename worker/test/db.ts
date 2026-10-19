// A real local D1 for Worker tests (Miniflare, the engine behind `wrangler dev`), with every migration
// applied and one paired device whose key is DEVICE_KEY.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { convertV4MiniflareOptions, Miniflare } from 'miniflare'
import { sha256Hex } from '../auth'
import { handle, type Env } from '../index'
import { AUD, TEAM, testCerts } from './access-keys'

export const DEVICE_KEY = 'test-device-key-0123456789abcdef'
export const OTHER_KEY = 'other-device-key-0123456789abcdef'

/** Every SQL statement in migrations/, in order. */
export function migrationStatements(): string[] {
  return readdirSync('migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .flatMap((f) =>
      readFileSync(join('migrations', f), 'utf8')
        .replace(/--.*$/gm, '')
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean),
    )
}

/** Stands in for Cloudflare's rate limiter: 10 tries per key, as configured in wrangler.jsonc. */
export function testLimiter(limit = 10) {
  const counts = new Map<string, number>()
  const limiter: RateLimit = {
    async limit({ key }) {
      counts.set(key, (counts.get(key) ?? 0) + 1)
      return { success: counts.get(key)! <= limit }
    },
  }
  return limiter
}

/** `access: false` leaves the Worker's Access settings out, as on a PR preview. */
export async function createTestDb({ access = true }: { access?: boolean } = {}) {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default { fetch() { return new Response("") } }',
      d1Databases: ['DB'],
    }),
  )
  const db = (await mf.getD1Database('DB')) as unknown as D1Database
  for (const sql of migrationStatements()) await db.prepare(sql).run()
  for (const [key, label] of [
    [DEVICE_KEY, 'her iPad'],
    [OTHER_KEY, 'another iPad'],
  ])
    await db
      .prepare('INSERT INTO devices (key_hash, label, created_at) VALUES (?, ?, ?)')
      .bind(await sha256Hex(key), label, '2026-10-17T00:00:00Z')
      .run()

  const env: Env = {
    ASSETS: { fetch: async () => new Response('app') } as unknown as Fetcher,
    DB: db,
    PAIR_LIMITER: testLimiter(),
    ...(access ? { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD } : {}),
  }
  const certs = testCerts()

  /** Calls the Worker as the paired iPad (or with the given key, or none), or as a parent with an Access token. */
  async function call(
    method: string,
    path: string,
    {
      body,
      key = DEVICE_KEY,
      now = new Date('2026-10-17T12:00:00Z'),
      accessToken,
      ip = '203.0.113.7',
    }: { body?: unknown; key?: string | null; now?: Date; accessToken?: string; ip?: string } = {},
  ) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (key) headers.Authorization = `Bearer ${key}`
    if (accessToken) headers['Cf-Access-Jwt-Assertion'] = accessToken
    headers['CF-Connecting-IP'] = ip
    const request = new Request(`https://macworx.test${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const response = await handle(request, env, now, certs.fetchCerts)
    return { status: response.status, body: (await response.json()) as Record<string, any> }
  }

  return { db, env, call, certs, dispose: () => mf.dispose() }
}
