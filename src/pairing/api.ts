// The iPad's calls for pairing (SPEC §5.4, §6.9): trade a code for a device key.

export type PairResult =
  | { kind: 'paired'; key: string }
  | { kind: 'notAccepted' }
  | { kind: 'tooManyTries' }
  | { kind: 'offline' }
  | { kind: 'busy' }

/** POST /api/pair with the code she typed. */
export async function pair(code: string): Promise<PairResult> {
  let response: Response
  try {
    response = await fetch('/api/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
  } catch {
    return { kind: 'offline' }
  }
  if (response.status === 201) {
    const body = (await response.json().catch(() => null)) as { key?: unknown } | null
    // The server used the code; without a key to keep, the only way on is a new code.
    return typeof body?.key === 'string' ? { kind: 'paired', key: body.key } : { kind: 'notAccepted' }
  }
  if (response.status === 400) return { kind: 'notAccepted' }
  if (response.status === 429) return { kind: 'tooManyTries' }
  return { kind: 'busy' }
}
