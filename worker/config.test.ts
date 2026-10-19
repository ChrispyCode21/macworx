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

  it('keep production and previews on different databases', () => {
    expect(main.d1_databases[0].database_id).not.toBe(main.previews.d1_databases[0].database_id)
  })
})
