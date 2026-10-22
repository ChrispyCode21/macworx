// Pairing (SPEC §6.9): a parent makes a one-time code behind Access, and the unpaired iPad trades it for
// its device key. POST /api/pair is the one write route with no key or token (CLAUDE.md); the code is the gate.
import { sha256Hex } from './auth'
import { error, json, readJson } from './http'
import { logChange, type ParentRequest } from './parent'

const CODE_LIFE_MS = 10 * 60 * 1000
const MAX_TRIES = 5
const MAX_NAME = 40

/**
 * The rate-limit key for an address: IPv4 as is, IPv6 by its /64 block, since one home or connection
 * controls a whole /64 and could otherwise use a fresh address for every try.
 */
export function addressKey(address: string): string {
  if (!address.includes(':')) return address
  const [head, tail] = address.toLowerCase().split('::')
  const front = head ? head.split(':') : []
  const back = tail ? tail.split(':') : []
  const groups =
    tail === undefined
      ? front
      : [...front, ...Array(Math.max(0, 8 - front.length - back.length)).fill('0'), ...back]
  return `${groups
    .slice(0, 4)
    .map((g) => g.replace(/^0+(?=.)/, ''))
    .join(':')}::/64`
}

/** A uniformly random 6-digit code: rejection sampling, so no code is likelier than another. */
function newCode(): string {
  const limit = Math.floor(0x1_0000_0000 / 1_000_000) * 1_000_000
  for (;;) {
    const [n] = crypto.getRandomValues(new Uint32Array(1))
    if (n < limit) return String(n % 1_000_000).padStart(6, '0')
  }
}

function newKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * The preview pairing code (SPEC §6.9), or undefined when it must do nothing. Fails closed: the Worker
 * must carry the preview mark and no Access settings at all (production always has them), and the secret
 * must be exactly 6 digits.
 */
export function previewPairCode(env: {
  PREVIEW?: string
  PREVIEW_PAIR_CODE?: string
  ACCESS_AUD?: string
  ACCESS_TEAM_DOMAIN?: string
}): string | undefined {
  if (env.PREVIEW !== '1' || env.ACCESS_AUD !== undefined || env.ACCESS_TEAM_DOMAIN !== undefined) return
  return /^\d{6}$/.test(env.PREVIEW_PAIR_CODE ?? '') ? env.PREVIEW_PAIR_CODE : undefined
}

/** POST /api/parent/pairing-code { name } → { code, expiresAt }. Voids any earlier unused code. */
export async function postPairingCode(req: ParentRequest): Promise<Response> {
  const { request, db, now } = req
  const body = (await readJson(request)) as { name?: unknown } | undefined
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (name.length < 1 || name.length > MAX_NAME) return error(400, 'bad_name')

  const code = newCode()
  const expiresAt = new Date(now.getTime() + CODE_LIFE_MS).toISOString()
  await db.batch([
    db
      .prepare('UPDATE pairing_codes SET voided_at = ? WHERE used_at IS NULL AND voided_at IS NULL')
      .bind(now.toISOString()),
    db
      .prepare('INSERT INTO pairing_codes (code_hash, name, created_at, expires_at) VALUES (?, ?, ?, ?)')
      .bind(await sha256Hex(code), name, now.toISOString(), expiresAt),
    logChange(db, req, 'pairing_code', { name }),
  ])
  return json(201, { code, expiresAt })
}

/** POST /api/pair { code } → { key }, once. Every refusal looks the same, so a guess learns nothing. */
export async function postPair({
  request,
  db,
  now,
  limiter,
  previewCode,
}: {
  request: Request
  db: D1Database
  now: Date
  limiter?: RateLimit
  /** From `previewPairCode`: set only on a PR preview. */
  previewCode?: string
}) {
  // Rate limit first, before the code is even read, so a flood of guesses can't void a parent's code.
  if (!limiter) return error(503, 'unavailable')
  const address = addressKey(request.headers.get('CF-Connecting-IP') ?? 'unknown')
  if (!(await limiter.limit({ key: `pair:${address}` })).success) return error(429, 'too_many_tries')

  const body = (await readJson(request)) as { code?: unknown } | undefined
  const code = typeof body?.code === 'string' ? body.code : ''
  if (!/^\d{6}$/.test(code)) return error(400, 'bad_code')

  const at = now.toISOString()
  // A PR preview's own code pairs a new device each time, without a parent's code (SPEC §6.9).
  if (previewCode !== undefined && (await sha256Hex(code)) === (await sha256Hex(previewCode))) {
    const key = newKey()
    await db
      .prepare('INSERT INTO devices (key_hash, label, created_at) VALUES (?, ?, ?)')
      .bind(await sha256Hex(key), 'Preview', at)
      .run()
    return json(201, { key })
  }

  // Every try is counted before the code is compared, in one statement: the newest usable code gets
  // attempts + 1 and comes back. So a burst of tries at once gets 5 comparisons between them, no more.
  const tried = await db
    .prepare(
      `UPDATE pairing_codes SET attempts = attempts + 1
       WHERE id = (SELECT id FROM pairing_codes
                   WHERE used_at IS NULL AND voided_at IS NULL AND attempts < ? AND expires_at > ?
                   ORDER BY id DESC LIMIT 1)
       RETURNING id, code_hash, attempts`,
    )
    .bind(MAX_TRIES, at)
    .first<{ id: number; code_hash: string; attempts: number }>()
  if (!tried) return error(400, 'bad_code')

  const hash = await sha256Hex(code)
  if (hash !== tried.code_hash) {
    // The fifth wrong try voids the code.
    if (tried.attempts >= MAX_TRIES)
      await db
        .prepare(
          'UPDATE pairing_codes SET voided_at = ? WHERE id = ? AND used_at IS NULL AND voided_at IS NULL',
        )
        .bind(at, tried.id)
        .run()
    return error(400, 'bad_code')
  }

  // The right code: claim it and create the device in one transaction. Only the request whose claim
  // landed creates a device, so two requests with the same code can't both pair.
  const key = newKey()
  const claim = crypto.randomUUID()
  const [claimed] = await db.batch([
    db
      .prepare(
        `UPDATE pairing_codes SET used_at = ?, claim = ?
         WHERE id = ? AND code_hash = ? AND used_at IS NULL AND voided_at IS NULL AND attempts <= ? AND expires_at > ?`,
      )
      .bind(at, claim, tried.id, hash, MAX_TRIES, at),
    db
      .prepare(
        `INSERT INTO devices (key_hash, label, created_at)
         SELECT ?, name, ? FROM pairing_codes WHERE id = ? AND claim = ?`,
      )
      .bind(await sha256Hex(key), at, tried.id, claim),
  ])
  if (claimed.meta.changes !== 1) return error(400, 'bad_code')
  return json(201, { key })
}
