// Device keys (SPEC §2): every child request carries its iPad's key. Only the key's SHA-256 is stored.

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** The paired, not revoked device whose key the request carries, with the child it belongs to, or null. */
export async function deviceFor(
  request: Request,
  db: D1Database,
): Promise<{ id: number; childId: number } | null> {
  const match = /^Bearer ([A-Za-z0-9_-]{20,200})$/.exec(request.headers.get('Authorization') ?? '')
  if (!match) return null
  const row = await db
    .prepare('SELECT id, child_id FROM devices WHERE key_hash = ? AND revoked_at IS NULL')
    .bind(await sha256Hex(match[1]))
    .first<{ id: number; child_id: number }>()
  return row ? { id: row.id, childId: row.child_id } : null
}
