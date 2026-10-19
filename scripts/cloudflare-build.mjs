// The Workers Builds build command (`npm run build:cloudflare`, ARCHITECTURE.md "Hosting"): applies D1
// migrations to the right database for the branch being built, before the deploy step runs.
// main → macworx (production); any other branch → macworx-preview, which preview URLs use.
// Kept in the repo rather than in the dashboard's deploy fields, so it's reviewed and versioned.
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const PRODUCTION_BRANCH = 'main'

/** wrangler's arguments to migrate the database for `branch`. */
export function migrationArgs(branch) {
  return branch === PRODUCTION_BRANCH
    ? ['d1', 'migrations', 'apply', 'macworx', '--remote']
    : ['d1', 'migrations', 'apply', 'macworx-preview', '--remote', '-c', 'wrangler.preview-migrations.jsonc']
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const branch = process.env.WORKERS_CI_BRANCH
  if (!process.env.WORKERS_CI || !branch) {
    console.error(
      'Only for Workers Builds (WORKERS_CI and WORKERS_CI_BRANCH are not set). Use npm run build.',
    )
    process.exit(1)
  }
  const args = migrationArgs(branch)
  console.log(`Branch ${branch}: wrangler ${args.join(' ')}`)
  // wrangler run with Node directly: no shell, so nothing gets split or reinterpreted.
  execFileSync(process.execPath, [join('node_modules', 'wrangler', 'bin', 'wrangler.js'), ...args], {
    stdio: 'inherit',
  })
}
