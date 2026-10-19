// Small HTTP helpers for the Worker. Every error body is { error: code }.

export function json(status: number, body: unknown): Response {
  return Response.json(body, { status })
}

export function error(status: number, code: string): Response {
  return json(status, { error: code })
}

/** The request's JSON body, or undefined when it isn't valid JSON. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return undefined
  }
}

export function isUint32(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 0xffffffff
}

/** The Worker's date (UTC) as YYYY-MM-DD. */
export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10)
}
