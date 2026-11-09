// Turns one reading passage file (kept OUTSIDE the repo) into one SQL file of INSERTs (SPEC §6.10).
//   node scripts/passage-sql.mjs <passage.json> --id <N> [--image <ext>] --out <file.sql>
// Run the SQL once per database: `wrangler d1 execute <db> --remote --file <file.sql>`.
// The choices are shuffled when the SQL is written, so run the SAME file on preview and production and
// don't run this script again in between, or the two databases won't match.
import { randomInt } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

/** Reading speed behind a passage's "minutes": words / WORDS_PER_MINUTE, rounded, at least 1. */
const WORDS_PER_MINUTE = 120
const MAX_QUESTIONS = 50
const LETTERS = ['A', 'B', 'C', 'D']

const isText = (v) => typeof v === 'string' && v.trim().length > 0
const quote = (s) => `'${String(s).replaceAll("'", "''")}'`

/** Fisher-Yates with crypto randomness; returns a new array. */
function shuffled(items) {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Which option a question's correct_answer names: its exact text, else a letter A-D no option's text equals. */
function correctIndexes(q) {
  const byText = q.options.flatMap((o, i) => (o === q.correct_answer ? [i] : []))
  if (byText.length > 0) return byText
  const letter = LETTERS.indexOf(q.correct_answer)
  return letter >= 0 ? [letter] : []
}

/**
 * Checks a passage and builds its SQL. Returns { errors, sql, summary }; sql and summary are null when
 * there are errors. Messages name questions by number and never quote passage text.
 */
export function buildPassageSql(data, { id, image }) {
  const errors = []
  if (!/^[1-9]\d*$/.test(String(id))) errors.push('--id must be a positive whole number.')
  if (image !== undefined && !/^[a-z0-9]+$/i.test(image))
    errors.push('--image must be a file extension such as webp.')
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { errors: [...errors, 'The file must hold one JSON object.'], sql: null, summary: null }
  }

  if (!isText(data.title)) errors.push('"title" is missing or empty.')
  const paragraphs = data.passage
  const paragraphsOk = Array.isArray(paragraphs) && paragraphs.length > 0 && paragraphs.every(isText)
  if (!paragraphsOk) errors.push('"passage" must be a list of paragraphs, none empty.')

  const questions = Array.isArray(data.questions) ? data.questions : []
  if (questions.length < 1 || questions.length > MAX_QUESTIONS) {
    errors.push(`"questions" must hold 1 to ${MAX_QUESTIONS} questions.`)
  }
  const prepared = questions.map((q, i) => {
    const where = `Question ${i + 1}`
    if (q === null || typeof q !== 'object') {
      errors.push(`${where}: must be an object.`)
      return null
    }
    if (q.number !== i + 1)
      errors.push(`${where}: "number" is ${JSON.stringify(q.number)}, expected ${i + 1}.`)
    if (!isText(q.question)) errors.push(`${where}: "question" is missing or empty.`)
    if (q.explanation !== undefined && typeof q.explanation !== 'string') {
      errors.push(`${where}: "explanation" must be text.`)
    }
    const options = q.options
    if (!Array.isArray(options) || options.length !== 4 || !options.every(isText)) {
      errors.push(`${where}: "options" must be exactly four non-empty choices.`)
      return null
    }
    if (new Set(options).size !== 4) {
      errors.push(`${where}: the four options must all be different.`)
      return null
    }
    const matches = correctIndexes(q)
    if (matches.length !== 1) {
      errors.push(`${where}: "correct_answer" must match exactly one option (it matches ${matches.length}).`)
      return null
    }
    return { q, correct: matches[0] }
  })
  if (errors.length > 0 || !paragraphsOk) return { errors, sql: null, summary: null }

  const words = paragraphs.join(' ').split(/\s+/).filter(Boolean).length
  const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE))
  const imageName = image === undefined ? null : `${id}.${image}`
  const rows = [
    `INSERT INTO passages (id, title, genre, minutes, hint, body, image) VALUES (${id}, ${quote(data.title)}, '', ${minutes}, '', ${quote(paragraphs.join('\n\n'))}, ${imageName === null ? 'NULL' : quote(imageName)});`,
  ]
  const choiceRows = []
  prepared.forEach(({ q, correct }, i) => {
    const questionId = id * 100 + (i + 1)
    rows.push(
      `INSERT INTO questions (id, passage_id, position, text, explanation) VALUES (${questionId}, ${id}, ${i + 1}, ${quote(q.question)}, ${quote(q.explanation ?? '')});`,
    )
    shuffled(q.options.map((text, index) => ({ text, right: index === correct }))).forEach((c, p) => {
      choiceRows.push(
        `INSERT INTO choices (id, question_id, position, text, correct) VALUES (${questionId * 10 + p + 1}, ${questionId}, ${p + 1}, ${quote(c.text)}, ${c.right ? 1 : 0});`,
      )
    })
  })
  return {
    errors,
    sql: [...rows, ...choiceRows].join('\n') + '\n',
    summary: { words, minutes, questions: questions.length, image: imageName },
  }
}

function main() {
  let parsed
  try {
    parsed = parseArgs({
      allowPositionals: true,
      options: { id: { type: 'string' }, image: { type: 'string' }, out: { type: 'string' } },
    })
  } catch (e) {
    parsed = { values: {}, positionals: [], error: e.message }
  }
  const { values, positionals } = parsed
  const usage = 'Usage: node scripts/passage-sql.mjs <passage.json> --id <N> [--image <ext>] --out <file.sql>'
  const problems = []
  if (parsed.error) problems.push(parsed.error)
  if (positionals.length !== 1) problems.push('Give exactly one passage file.')
  if (!values.out) problems.push('--out <file.sql> is required.')
  if (values.id === undefined) problems.push('--id <N> is required.')

  let data = null
  if (positionals.length === 1) {
    try {
      data = JSON.parse(readFileSync(positionals[0], 'utf8'))
    } catch (e) {
      // Only the reason, never the file's text.
      problems.push(`Can't read ${positionals[0]} as JSON (${e.code ?? 'invalid JSON'}).`)
    }
  }
  const built =
    data !== null && values.id !== undefined
      ? buildPassageSql(data, { id: values.id, image: values.image })
      : { errors: [], sql: null, summary: null }
  problems.push(...built.errors)
  if (problems.length > 0 || built.sql === null) {
    console.error(`${problems.length} problem(s), nothing written:`)
    for (const p of problems) console.error(`- ${p}`)
    console.error(usage)
    process.exit(1)
  }
  const id = Number(values.id)
  writeFileSync(values.out, built.sql)
  const { words, minutes, questions, image } = built.summary
  console.log(`Passage ${id}: ${data.title}`)
  console.log(`Words: ${words}, minutes: ${minutes}, questions: ${questions}`)
  console.log(`Picture: ${image ?? 'no picture'}${image ? ' (upload it to R2 with this name)' : ''}`)
  console.log(`Wrote ${values.out}`)
  console.log(
    'Run this same file once on preview and once on production. Do not run the script again in between: the choices are shuffled each time.',
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
