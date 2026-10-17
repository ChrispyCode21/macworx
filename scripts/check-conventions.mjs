// Fails on code that breaks the mechanical rules in CLAUDE.md, "Architecture rules":
// - the engine (src/engine/) uses no Math.random; randomness comes from the seed (SPEC §8).
//   Imports, fetch, the DOM and Date are oxlint's job (.oxlintrc.json).
// - grade labels appear only in the config module (src/engine/config.ts).
// - never-negative wording: no failure words in UI text (src/**/*.tsx).
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
function check(file, rules) {
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    if (line.includes('conventions-ignore') || /^\s*(\/\/|\*|\/\*)/.test(line)) return
    for (const { test, message } of rules) {
      if (test(line))
        problems.push(`${relative('.', file).replaceAll('\\', '/')}:${i + 1}  ${message}\n    ${line.trim()}`)
    }
  })
}

const isTest = (f) => /\.test\.tsx?$/.test(f)
const source = files('src', /\.tsx?$/).filter((f) => !isTest(f))

const engineRules = [
  {
    test: (l) => /\bMath\.random\b/.test(l),
    message: 'The engine takes randomness from the seed (SPEC §8), not Math.random.',
  },
]
const gradeRules = [
  {
    test: (l) => /['"`](Excellent|Great|Good|Improving)['"`]/.test(l),
    message: 'Grade labels live in src/engine/config.ts (CLAUDE.md); import them from there.',
  },
]
const wordingRules = [
  {
    test: (l) => /\b(wrong|fail(s|ed|ure)?|incorrect|bad|lose|lost|loser|penalty|mistakes?|oops)\b/i.test(l),
    message: 'Never-negative wording (CLAUDE.md): no text frames a result as failure.',
  },
]

for (const f of source.filter((f) => f.startsWith(join('src', 'engine')))) check(f, engineRules)
for (const f of source.filter((f) => f !== join('src', 'engine', 'config.ts'))) check(f, gradeRules)
for (const f of source.filter((f) => f.endsWith('.tsx'))) check(f, wordingRules)

if (problems.length > 0) {
  console.error(`Convention problems (CLAUDE.md, "Architecture rules"):\n\n${problems.join('\n\n')}`)
  process.exit(1)
}
console.log('Engine, grade labels and wording follow the conventions.')
