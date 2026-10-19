import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { migrationArgs } from './cloudflare-build.mjs'

describe('Workers Builds migrations', () => {
  it('migrates production only for main', () => {
    expect(migrationArgs('main')).toEqual(['d1', 'migrations', 'apply', 'macworx', '--remote'])
  })

  it('migrates the preview database for every other branch, through the preview config', () => {
    for (const branch of ['save/child-api', 'main-backup', 'release/v0.2.0']) {
      expect(migrationArgs(branch)).toEqual([
        'd1',
        'migrations',
        'apply',
        'macworx-preview',
        '--remote',
        '-c',
        'wrangler.preview-migrations.jsonc',
      ])
    }
  })

  it('refuses to run outside Workers Builds, so it never migrates a remote database by accident', () => {
    const env = { ...process.env }
    delete env.WORKERS_CI
    delete env.WORKERS_CI_BRANCH
    const run = spawnSync(process.execPath, ['scripts/cloudflare-build.mjs'], { env, encoding: 'utf8' })
    expect(run.status).toBe(1)
    expect(run.stderr).toContain('Only for Workers Builds')
  })
})
