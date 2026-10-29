// Pairs a device without a pairing code (the Pair screen is the normal way, SPEC §5.4): prints a new device key and stores
// only its SHA-256 in D1. Give the key to the app as its device key.
//   node scripts/create-device.mjs --local  "her iPad"   -> the local D1 used by `npm run worker:dev`
//   node scripts/create-device.mjs --remote "her iPad"   -> production (needs `wrangler login`)
import { execFileSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [where, label = 'device'] = process.argv.slice(2)
if (where !== '--local' && where !== '--remote') {
  console.error('Usage: node scripts/create-device.mjs --local|--remote [label]')
  process.exit(1)
}
if (!/^[\w ,.'-]{1,40}$/.test(label)) {
  console.error("Use a short label: letters, numbers, spaces and , . ' - only.")
  process.exit(1)
}

const key = randomBytes(32).toString('base64url')
const hash = createHash('sha256').update(key).digest('hex')
// The device belongs to the first child (SPEC §6.9). ORDER BY id LIMIT 1 inserts nothing when there is no child.
const sql = `INSERT INTO devices (key_hash, label, created_at, child_id) SELECT '${hash}', '${label.replaceAll("'", "''")}', datetime('now'), id FROM children ORDER BY id LIMIT 1`

// Through a file, and wrangler run with Node directly (no shell), so neither the SQL nor a temp path
// with spaces in it gets split into separate arguments.
const wrangler = join('node_modules', 'wrangler', 'bin', 'wrangler.js')
const dir = mkdtempSync(join(tmpdir(), 'macworx-device-'))
const file = join(dir, 'device.sql')
writeFileSync(file, `${sql};\n`)
let output
try {
  output = execFileSync(
    process.execPath,
    [wrangler, 'd1', 'execute', 'macworx', where, '--json', '--file', file],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    },
  )
} finally {
  rmSync(dir, { recursive: true, force: true })
}
// No row inserted means the database has no child to own the device: print no key.
const inserted = JSON.parse(output.slice(output.indexOf('[')))
if (!inserted.some((r) => r.meta?.changes === 1)) {
  console.error('No device was created: the database has no child yet.')
  process.exit(1)
}
console.log(`\nDevice key for "${label}" (shown once, keep it private):\n${key}`)
