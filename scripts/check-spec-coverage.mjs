// Fails if any worked example in SPEC.md §7 has no unit test named with its ID (CLAUDE.md, "Tests").
// A test counts when its name starts with the ID and a colon, e.g. it('P4: ...').
// IDs listed in scripts/spec-pending.txt may go untested until their slice lands; listing one that
// already has a test, or that isn't in §7, also fails, so the list only ever shrinks.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const spec = readFileSync('SPEC.md', 'utf8')
const section = spec.match(/^## 7\..*?(?=^## 8\.)/ms)?.[0]
if (!section) {
  console.error('Could not find SPEC.md §7 (between "## 7." and "## 8.").')
  process.exit(1)
}

// Table rows look like "| P4 | ... |".
const ids = [...section.matchAll(/^\| ([A-Z]\d+[a-z]?) \|/gm)].map((m) => m[1])

const pending = readFileSync('scripts/spec-pending.txt', 'utf8')
  .split('\n')
  .map((line) => line.replace(/#.*/, '').trim())
  .filter(Boolean)

function testFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name)
    if (e.isDirectory()) return testFiles(path)
    return /\.test\.tsx?$/.test(e.name) ? [path] : []
  })
}
// Comments are dropped, so a commented-out test doesn't count. Skipped tests fail check-conventions.
const tests = testFiles('src')
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
const tested = (id) => new RegExp(`\\bit\\(\\s*['"\`]${id}:`).test(tests)

const problems = []
const missing = ids.filter((id) => !tested(id) && !pending.includes(id))
if (missing.length) problems.push(`SPEC §7 examples with no test named after them: ${missing.join(', ')}`)
const stale = pending.filter((id) => tested(id) || !ids.includes(id))
if (stale.length)
  problems.push(`scripts/spec-pending.txt lists IDs that are tested or not in SPEC §7: ${stale.join(', ')}`)

if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}
const done = ids.length - pending.length
console.log(`${done} of ${ids.length} SPEC §7 examples have tests; ${pending.length} pending.`)
