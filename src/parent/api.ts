// The parent page's calls (SPEC §5.3, §6.9). Cloudflare Access guards /api/parent: when its session has
// run out, a call gets a redirect to sign in instead of an answer. The page then reloads /parent once, so
// Access can ask the parent to sign in again. A JSON answer is the Worker's own and never reloads (it's
// what a preview, which has no Access, always gets), so a refusal there can't loop.

const RELOADED = 'macworx.parentReloaded'

export type ParentResult<T> = { ok: true; body: T } | { ok: false; status: number; error: string }

export async function parentCall<T>(path: string, init: RequestInit = {}): Promise<ParentResult<T>> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      redirect: 'manual',
      headers: { 'Content-Type': 'application/json', ...init.headers },
    })
  } catch {
    return { ok: false, status: 0, error: 'offline' }
  }
  const body = response.type === 'opaqueredirect' ? null : await response.json().catch(() => null)
  if (body === null) {
    if (sessionStorage.getItem(RELOADED) === null) {
      sessionStorage.setItem(RELOADED, '1')
      location.reload()
    }
    return { ok: false, status: response.status, error: 'signed_out' }
  }
  sessionStorage.removeItem(RELOADED)
  return response.ok
    ? { ok: true, body: body as T }
    : { ok: false, status: response.status, error: String((body as { error?: unknown }).error ?? 'server') }
}

export interface Device {
  id: number
  label: string
  createdAt: string
  revokedAt: string | null
}

export const listDevices = () => parentCall<{ devices: Device[] }>('/api/parent/devices')

export const unpair = (id: number) =>
  parentCall<{ ok: true }>(`/api/parent/devices/${id}`, { method: 'DELETE' })

export const makeCode = (name: string) =>
  parentCall<{ code: string; expiresAt: string }>('/api/parent/pairing-code', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
