import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** wrangler's JSONC: drops line comments and trailing commas, then parses. */
function readJsonc(path: string) {
  const text = readFileSync(path, 'utf8')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/,(\s*[}\]])/g, '$1')
  return JSON.parse(text)
}

describe('wrangler configs', () => {
  const main = readJsonc('wrangler.jsonc')
  const previewMigrations = readJsonc('wrangler.preview-migrations.jsonc')

  it('migrate the same preview database that preview URLs use', () => {
    expect(previewMigrations.d1_databases).toEqual(main.previews.d1_databases)
  })

  it('give production the Access settings, and previews none, so previews never serve parent routes', () => {
    expect(main.vars.ACCESS_TEAM_DOMAIN).toMatch(/^[a-z0-9-]+\.cloudflareaccess\.com$/)
    expect(main.vars.ACCESS_AUD).toMatch(/^[0-9a-f]{64}$/)
    expect(main.previews.vars).toBeUndefined()
  })

  it('rate-limit pairing in production and previews, with separate counters', () => {
    const [prod] = main.ratelimits
    const [preview] = main.previews.ratelimits
    expect(prod).toMatchObject({ name: 'PAIR_LIMITER', simple: { limit: 10, period: 60 } })
    expect(preview).toMatchObject({ name: 'PAIR_LIMITER', simple: { limit: 10, period: 60 } })
    expect(prod.namespace_id).not.toBe(preview.namespace_id)
  })

  it('keep production and previews on different databases', () => {
    expect(main.d1_databases[0].database_id).not.toBe(main.previews.d1_databases[0].database_id)
  })
})
