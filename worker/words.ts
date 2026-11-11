// The spelling words a parent adds from the portal (SPEC §5.3, §6.11, §8). The checks are the engine's, the same ones
// the portal ran before sending; this is the second look. Words are shared by every child, so no route here takes a
// `child`, and none looks anything up in a dictionary.
import { checkWord, normalizeTyped, SPELLING } from '../src/engine'
import { error, json } from './http'
import type { ParentRequest } from './parent-request'

/** The most problems listed at once; the rest are counted. */
const MAX_LISTED = 10

const bad = (problems: string[]) => json(400, { error: 'bad_word', problems })

/** A grade is a whole number from 0 to 99, or nothing (kept for later; nothing reads it yet). */
const validGrade = (grade: unknown): grade is number | null | undefined =>
  grade === undefined ||
  grade === null ||
  (typeof grade === 'number' && Number.isInteger(grade) && grade >= 0 && grade <= 99)

/** POST /api/parent/words { words }: adds the entries that pass the checks, skipping any already in the list. */
export async function postWords({ request, db, now }: ParentRequest): Promise<Response> {
  // The size is counted in bytes, and a request that says it is over the limit is refused before it is read.
  const tooMany = ['That is too many words to save at once.']
  if (Number(request.headers.get('content-length')) > SPELLING.saveBytes) return bad(tooMany)
  const raw = await request.text()
  if (new TextEncoder().encode(raw).length > SPELLING.saveBytes) return bad(tooMany)
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return bad(['The request has to be JSON like { "words": [ … ] }.'])
  }
  const words = typeof body === 'object' && body !== null ? (body as { words?: unknown }).words : undefined
  if (!Array.isArray(words)) return bad(['The request has to be JSON like { "words": [ … ] }.'])
  if (words.length > SPELLING.perSave) return bad([`A save can have at most ${SPELLING.perSave} words.`])

  // Every entry is checked before anything is saved, so one refused word saves none of them.
  const problems: string[] = []
  const unique = new Map<
    string,
    { word: string; sentence: string; alternates: string[]; grade: number | null }
  >()
  for (const entry of words) {
    const checked = checkWord(entry)
    const grade = (entry as { grade?: unknown } | null)?.grade
    if (!checked.ok) problems.push(...checked.problems)
    else if (!validGrade(grade))
      problems.push(`The grade for "${checked.entry.word}" has to be a whole number from 0 to 99.`)
    else {
      const key = normalizeTyped(checked.entry.word)
      // A word repeated in one save is one word: the first sentence and grade given, every alternate.
      const earlier = unique.get(key)
      if (!earlier)
        unique.set(key, {
          word: checked.entry.word,
          sentence: checked.entry.sentence,
          alternates: checked.entry.alternates,
          grade: grade ?? null,
        })
      else {
        earlier.sentence ||= checked.entry.sentence
        earlier.grade ??= grade ?? null
        const seen = new Set([key, ...earlier.alternates.map(normalizeTyped)])
        for (const alternate of checked.entry.alternates)
          if (!seen.has(normalizeTyped(alternate))) {
            seen.add(normalizeTyped(alternate))
            earlier.alternates.push(alternate)
          }
      }
    }
  }
  if (problems.length > 0)
    return bad(
      problems.length > MAX_LISTED
        ? [...problems.slice(0, MAX_LISTED), `…and ${problems.length - MAX_LISTED} more to fix.`]
        : problems,
    )

  // A word already in the list (its key is unique) is left alone, not an error; what is inserted is what was added.
  // Only a clash on the key is passed over: any other refusal by the table fails the whole save.
  const rows = [...unique].map(([key, row]) => ({ key, ...row, alternates: JSON.stringify(row.alternates) }))
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

interface WordRow {
  id: number
  word: string
  sentence: string
  alternates: string
  grade: number | null
}

const present = (row: WordRow) => ({
  id: row.id,
  word: row.word,
  sentence: row.sentence,
  alternates: JSON.parse(row.alternates) as string[],
  grade: row.grade,
})

/** GET /api/parent/words: every word, alphabetical ignoring capitals. */
export async function listWords({ db }: ParentRequest): Promise<Response> {
  const rows = await db
    .prepare('SELECT id, word, sentence, alternates, grade FROM words ORDER BY id')
    .all<WordRow>()
  const collator = new Intl.Collator('en', { sensitivity: 'accent' })
  const sorted = [...rows.results].sort((a, b) => collator.compare(a.word, b.word) || a.id - b.id)
  return json(200, { words: sorted.map(present) })
}

/** PATCH /api/parent/words/:id: changes the fields sent, checked as an entry is. */
export async function patchWord({ request, db, params }: ParentRequest): Promise<Response> {
  const id = Number(params.id)
  const stored = await db
    .prepare('SELECT id, word, sentence, alternates, grade FROM words WHERE id = ?')
    .bind(id)
    .first<WordRow>()
  if (!stored) return error(404, 'unknown_word')

  let body: unknown
  try {
    const raw = await request.text()
    // The same size limit as a save, counted in bytes.
    if (new TextEncoder().encode(raw).length > SPELLING.saveBytes) return bad(['That is too long to save.'])
    body = JSON.parse(raw)
  } catch {
    body = undefined
  }
  const sent =
    typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null
  if (!sent || !['word', 'sentence', 'alternates', 'grade'].some((field) => field in sent))
    return bad(['There is nothing to change.'])

  const checked = checkWord({
    word: 'word' in sent ? sent.word : stored.word,
    sentence: 'sentence' in sent ? sent.sentence : stored.sentence,
    alternates: 'alternates' in sent ? sent.alternates : JSON.parse(stored.alternates),
  })
  if (!checked.ok) return bad(checked.problems)
  const grade = 'grade' in sent ? sent.grade : stored.grade
  if (!validGrade(grade)) return bad(['The grade has to be a whole number from 0 to 99.'])

  // The same word with other capitals is this word, not a clash; another row with the key is.
  const key = normalizeTyped(checked.entry.word)
  const clash = await db.prepare('SELECT id FROM words WHERE key = ? AND id <> ?').bind(key, id).first()
  if (clash) return error(409, 'duplicate')

  // Only the fields sent are written, so two edits of different fields don't undo each other.
  const set: string[] = []
  const values: unknown[] = []
  if ('word' in sent) {
    set.push('word = ?', 'key = ?')
    values.push(checked.entry.word, key)
  }
  if ('sentence' in sent) {
    set.push('sentence = ?')
    values.push(checked.entry.sentence)
  }
  if ('alternates' in sent) {
    set.push('alternates = ?')
    values.push(JSON.stringify(checked.entry.alternates))
  }
  if ('grade' in sent) {
    set.push('grade = ?')
    values.push(grade ?? null)
  }
  let changed: number
  try {
    const statements = [db.prepare(`UPDATE words SET ${set.join(', ')} WHERE id = ?`).bind(...values, id)]
    // A change she could hear or be marked on voids the unchecked attempts that hold the word, in the same
    // transaction (SPEC §6.11); saving the same text again, or a grade alone, doesn't.
    const heard =
      checked.entry.word !== stored.word ||
      checked.entry.sentence !== stored.sentence ||
      JSON.stringify(checked.entry.alternates) !== stored.alternates
    if (heard) statements.push(voidAttempts(db, id))
    changed = (await db.batch(statements))[0]!.meta.changes
  } catch (e) {
    // Another save took this word between the look above and the write.
    if (/UNIQUE/i.test(String(e))) return error(409, 'duplicate')
    throw e
  }
  // The word was deleted between the read and the write: nothing was changed.
  if (changed === 0) return error(404, 'unknown_word')
  return json(200, {
    word: {
      id,
      word: checked.entry.word,
      sentence: checked.entry.sentence,
      alternates: checked.entry.alternates,
      grade: grade ?? null,
    },
  })
}

/** DELETE /api/parent/words/:id. */
export async function deleteWord({ db, params }: ParentRequest): Promise<Response> {
  const id = Number(params.id)
  const [result] = await db.batch([
    db.prepare('DELETE FROM words WHERE id = ?').bind(id),
    voidAttempts(db, id),
  ])
  return result!.meta.changes === 0 ? error(404, 'unknown_word') : json(200, { ok: true })
}

/** Removes the attempts she hasn't checked that hold this word, so her next start is new words (SPEC §6.11, E19). */
const voidAttempts = (db: D1Database, wordId: number) =>
  db
    .prepare(
      'DELETE FROM spelling_attempts WHERE used = 0 AND EXISTS (SELECT 1 FROM json_each(spelling_attempts.words) WHERE value = ?)',
    )
    .bind(wordId)
