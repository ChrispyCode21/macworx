// Fails on code that breaks the mechanical rules in CLAUDE.md, "Architecture rules" and "Tests":
// - the engine (src/engine/) has no .tsx files (no JSX) and no Math.random; randomness comes from
//   the seed (SPEC §8). Imports and globals (fetch, the DOM, Date) are oxlint's job (.oxlintrc.json).
// - grade labels appear only in the config module (src/engine/config.ts).
// - never-negative wording: no failure words in the app's strings or JSX text (src/).
// - no skipped, todo or focused tests, so a test named with a SPEC §7 ID always runs.
// - shared UI: <Button> from src/ui/ instead of a raw <button>, and number formatting only in
//   src/ui/format.ts; on-screen text only in src/copy.ts; colors only as tokens in src/index.css.
//
// A line can opt out with a comment containing `conventions-ignore` and a reason, e.g.
//   {/* conventions-ignore: "Great Wall" is a place name, not a grade */}
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

function files(dir, pattern) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name)
    if (e.isDirectory()) return files(path, pattern)
    return pattern.test(e.name) ? [path] : []
  })
}

const problems = []
const shown = (file) => relative('.', file).replaceAll('\\', '/')
function check(file, rules) {
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    if (line.includes('conventions-ignore') || /^\s*(\/\/|\*|\/\*)/.test(line)) return
    for (const { test, message } of rules) {
      if (test(line)) problems.push(`${shown(file)}:${i + 1}  ${message}\n    ${line.trim()}`)
    }
  })
}

const isTest = (f) => /\.test\.tsx?$/.test(f)
const source = files('src', /\.tsx?$/).filter((f) => !isTest(f))
const tests = [...files('src', /\.test\.tsx?$/), ...files('worker', /\.test\.ts$/)]
const inEngine = (f) => f.startsWith(join('src', 'engine'))

const engineRules = [
  {
    test: (l) => /\bMath\s*(\.\s*random\b|\[\s*['"`]random)/.test(l),
    message: 'The engine takes randomness from the seed (SPEC §8), not Math.random.',
  },
]
const gradeRules = [
  {
    test: (l) => /['"`](Excellent|Great|Good|Improving)['"`]/.test(l),
    message: 'Grade labels live in src/engine/config.ts (CLAUDE.md); import them from there.',
  },
]
const NEGATIVE = /\b(wrong|fail(s|ed|ure)?|incorrect|bad|lose|lost|loser|penalty|mistakes?|oops)\b/i
const wordingRules = [
  {
    // Inside a string literal, or JSX text between tags; identifiers like `failed` are fine.
    test: (l) =>
      [...l.matchAll(/(['"`])((?:(?!\1).)*)\1|>([^<{]+)/g)].some((m) => NEGATIVE.test(m[2] ?? m[3])),
    message: 'Never-negative wording (CLAUDE.md): no text frames a result as failure.',
  },
]
const testRules = [
  {
    test: (l) => /\b(it|test|describe)\.(skip|todo|only)\b|\bx(it|describe)\(/.test(l),
    message: 'No skipped, todo or focused tests: every spec example must run (CLAUDE.md, "Tests").',
  },
]

// Shared building blocks (ARCHITECTURE.md, "UI"): one Button, one place for display formatting.
const reuseRules = [
  {
    test: (l) => /<button[\s>]/.test(l),
    message: 'Use <Button> from src/ui/Button, not a raw <button>.',
  },
  {
    test: (l) => /\.(toLocaleString|toFixed)\(|\bIntl\./.test(l),
    message: 'Format numbers with src/ui/format.ts, not inline.',
  },
]
const inUi = (f) => f.startsWith(join('src', 'ui'))
// Text she sees lives in src/copy.ts: no words written straight into JSX.
const copyRules = [
  {
    // Text between tags, or Prettier-wrapped JSX text on a line of its own: two or more words, which
    // a line of code (an identifier in a wrapped import, say) never is.
    test: (l) => />\s*[A-Za-z][^<{}]*</.test(l) || /^\s*[A-Za-z][\w,.!?']*( [\w,.!?']+)+$/.test(l),
    message: 'Put on-screen text in src/copy.ts and use it from there.',
  },
]
// Colors are tokens: a hex value only where a custom property is defined (--name: #...).
const cssRules = [
  {
    test: (l) => /#[0-9a-fA-F]{3,8}\b/.test(l) && !/^\s*--[\w-]+\s*:/.test(l),
    message: 'Use a color token from the top of src/index.css, not a raw hex value.',
  },
]

for (const f of source.filter((f) => !inUi(f))) check(f, reuseRules)
for (const f of source.filter((f) => f.endsWith('.tsx'))) check(f, copyRules)
for (const f of files('src', /\.css$/)) check(f, cssRules)
for (const f of source.filter((f) => inEngine(f) && f.endsWith('.tsx')))
  problems.push(`${shown(f)}  The engine is pure TypeScript: no .tsx files or JSX (CLAUDE.md).`)
for (const f of source.filter(inEngine)) check(f, engineRules)
for (const f of source.filter((f) => f !== join('src', 'engine', 'config.ts'))) check(f, gradeRules)
for (const f of source) check(f, wordingRules)
for (const f of tests) check(f, testRules)

if (problems.length > 0) {
  console.error(`Convention problems (CLAUDE.md, "Architecture rules"):\n\n${problems.join('\n\n')}`)
  process.exit(1)
}
console.log('Engine, grade labels, wording and tests follow the conventions.')
