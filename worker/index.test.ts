import { describe, expect, it } from 'vitest'
import worker, { type Env } from './index'

const assets = { fetch: async () => new Response('app') } as unknown as Fetcher
const env: Env = { ASSETS: assets, DB: {} as D1Database }
const call = (path: string) =>
  worker.fetch(new Request(`https://macworx.test${path}`) as Parameters<typeof worker.fetch>[0], env)

describe('worker routing', () => {
  it('answers the health check', async () => {
    const res = await call('/api/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('returns 404 for unknown API paths', async () => {
    expect((await call('/api/nope')).status).toBe(404)
    expect((await call('/api')).status).toBe(404)
  })

  // In production run_worker_first sends only /api paths here; this guards local `wrangler dev`.
  it('passes anything else to the static assets', async () => {
    expect(await (await call('/')).text()).toBe('app')
  })
})
