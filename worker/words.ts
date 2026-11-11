// The spelling words a parent adds from the portal (SPEC §5.3, §6.11, §8). The checks are the engine's, the same ones
// the portal ran before sending; this is the second look. Words are shared by every child, so no route here takes a
// `child`, and none looks anything up in a dictionary.
import { checkWord, normalizeTyped } from '../src/engine'
import { json } from './http'
import type { ParentRequest } from './parent-request'

/** The most entries one save may carry, and the most characters of request body that are read at all. */
const MAX_ENTRIES = 500
const MAX_BODY = 256 * 1024

const bad = (problems: string[]) => json(400, { error: 'bad_word', problems })

/** A grade is a whole number from 0 to 99, or nothing (kept for later; nothing reads it yet). */
const validGrade = (grade: unknown): grade is number | null | undefined =>
  grade === undefined ||
  grade === null ||
  (typeof grade === 'number' && Number.isInteger(grade) && grade >= 0 && grade <= 99)

/** POST /api/parent/words { words }: adds the entries that pass the checks, skipping any already in the list. */
export async function postWords({ request, db, now }: ParentRequest): Promise<Response> {
  const raw = await request.text()
  if (raw.length > MAX_BODY) return bad(['That is too many words to save at once.'])
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return bad(['The request has to be JSON like { "words": [ … ] }.'])
  }
  const words = typeof body === 'object' && body !== null ? (body as { words?: unknown }).words : undefined
  if (!Array.isArray(words)) return bad(['The request has to be JSON like { "words": [ … ] }.'])
  if (words.length > MAX_ENTRIES) return bad([`A save can have at most ${MAX_ENTRIES} words.`])

  // Every entry is checked before anything is saved, so one refused word saves none of them.
  const problems: string[] = []
  const unique = new Map<
    string,
    { word: string; sentence: string; alternates: string; grade: number | null }
  >()
  for (const entry of words) {
    const checked = checkWord(entry)
    const grade = (entry as { grade?: unknown } | null)?.grade
    if (!checked.ok) problems.push(...checked.problems)
    else if (!validGrade(grade))
      problems.push(`The grade for "${checked.entry.word}" has to be a whole number.`)
    else {
      const key = normalizeTyped(checked.entry.word)
      if (!unique.has(key))
        unique.set(key, {
          word: checked.entry.word,
          sentence: checked.entry.sentence,
          alternates: JSON.stringify(checked.entry.alternates),
          grade: grade ?? null,
        })
    }
  }
  if (problems.length > 0) return bad(problems.slice(0, 10))

  // A word already in the list (its key is unique) is left alone, not an error; what is inserted is what was added.
  // Only a clash on the key is passed over: any other refusal by the table fails the whole save.
  const rows = [...unique].map(([key, row]) => ({ key, ...row }))
  const result = await db
    .prepare(
      `INSERT INTO words (word, key, sentence, alternates, grade, created_at)
       SELECT json_extract(value, '$.word'), json_extract(value, '$.key'), json_extract(value, '$.sentence'),
         json_extract(value, '$.alternates'), json_extract(value, '$.grade'), ? FROM json_each(?) WHERE true
       ON CONFLICT (key) DO NOTHING`,
    )
    .bind(now.toISOString(), JSON.stringify(rows))
    .run()
  const added = result.meta.changes
  return json(201, { added, skipped: words.length - added })
}
