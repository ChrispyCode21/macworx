// The rules for a pasted reading passage (SPEC §6.10). The portal checks before saving and the Worker checks
// again, with this same code. Every problem is a plain sentence a parent can act on.

/** The most questions a passage may have, and the most bytes of JSON one may be pasted as. */
export const PASSAGE_LIMITS = { questions: 50, options: 4, bytes: 64 * 1024 } as const

export interface CheckedQuestion {
  text: string
  /** Exactly four, in the order pasted. */
  options: string[]
  /** The index in `options` of the right one. */
  answer: number
  explanation: string
}

export interface CheckedPassage {
  title: string
  minutes: number
  paragraphs: string[]
  /** From `topic`, or ''. */
  genre: string
  hint: string
  questions: CheckedQuestion[]
  /** The whole pasted object, so every field in it is kept (SPEC §6.10). */
  source: Record<string, unknown>
}

export type PassageCheck = { ok: true; passage: CheckedPassage } | { ok: false; problems: string[] }

/** The most problems reported at once. */
const MAX_PROBLEMS = 10

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null

/** Checks a passage already parsed from JSON. */
export function checkPassage(value: unknown): PassageCheck {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return { ok: false, problems: ['Paste one JSON object, starting with { and ending with }.'] }
  const input = value as Record<string, unknown>
  const problems: string[] = []

  const title = text(input.title)
  if (title === null) problems.push('The passage needs a "title".')

  const minutes = input.minutes
  if (typeof minutes !== 'number' || !Number.isInteger(minutes) || minutes < 1)
    problems.push('The passage needs "minutes", a whole number of at least 1.')

  const paragraphs: string[] = []
  if (!Array.isArray(input.passage) || input.passage.length === 0) {
    problems.push('The passage needs "passage", a list of one or more paragraphs.')
  } else {
    input.passage.forEach((p, i) => {
      const t = text(p)
      if (t === null) problems.push(`Paragraph ${i + 1} is empty or isn't text.`)
      else paragraphs.push(t)
    })
  }

  for (const key of ['topic', 'hint'] as const)
    if (input[key] !== undefined && typeof input[key] !== 'string') problems.push(`"${key}" has to be text.`)

  const questions: CheckedQuestion[] = []
  if (
    !Array.isArray(input.questions) ||
    input.questions.length < 1 ||
    input.questions.length > PASSAGE_LIMITS.questions
  ) {
    problems.push(`The passage needs between 1 and ${PASSAGE_LIMITS.questions} "questions".`)
  } else {
    input.questions.forEach((raw, i) => {
      const n = i + 1
      const before = problems.length
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        problems.push(`Question ${n} isn't a question.`)
        return
      }
      const q = raw as Record<string, unknown>
      const questionText = text(q.question)
      if (questionText === null) problems.push(`Question ${n} has no "question" text.`)
      if (q.explanation !== undefined && typeof q.explanation !== 'string')
        problems.push(`Question ${n}'s "explanation" has to be text.`)

      if (!Array.isArray(q.options) || q.options.length !== PASSAGE_LIMITS.options) {
        const count = Array.isArray(q.options) ? q.options.length : 0
        problems.push(`Question ${n} needs exactly ${PASSAGE_LIMITS.options} "options" (it has ${count}).`)
        return
      }
      const options = q.options.map(text)
      if (options.some((o) => o === null)) {
        problems.push(`Question ${n} has an empty option.`)
        return
      }
      const choices = options as string[]
      const correct = text(q.correct_answer)
      const matches = correct === null ? 0 : choices.filter((o) => o === correct).length
      if (correct === null || matches === 0)
        problems.push(`Question ${n}'s "correct_answer" isn't one of its options.`)
      else if (matches > 1) problems.push(`Question ${n} has two right answers.`)
      else if (new Set(choices).size !== choices.length)
        problems.push(`Question ${n} has two options that are the same.`)

      if (problems.length === before && correct !== null)
        questions.push({
          text: questionText!,
          options: choices,
          answer: choices.indexOf(correct),
          explanation: typeof q.explanation === 'string' ? q.explanation.trim() : '',
        })
    })
  }

  if (problems.length > 0) {
    const shown = problems.slice(0, MAX_PROBLEMS)
    if (problems.length > MAX_PROBLEMS) shown.push(`…and ${problems.length - MAX_PROBLEMS} more to fix.`)
    return { ok: false, problems: shown }
  }
  return {
    ok: true,
    passage: {
      title: title!,
      minutes: minutes as number,
      paragraphs,
      genre: typeof input.topic === 'string' ? input.topic.trim() : '',
      hint: typeof input.hint === 'string' ? input.hint.trim() : '',
      questions,
      source: input,
    },
  }
}

/** Checks pasted text: JSON first, then the passage. */
export function parsePassageJson(pasted: string): PassageCheck {
  if (new TextEncoder().encode(pasted).length > PASSAGE_LIMITS.bytes)
    return { ok: false, problems: ['That is too long to be one passage (the limit is 64 KB).'] }
  let value: unknown
  try {
    value = JSON.parse(pasted)
  } catch {
    return {
      ok: false,
      problems: [
        "That isn't valid JSON. Check for a missing comma, quote or bracket, and remove any ``` lines around it.",
      ],
    }
  }
  return checkPassage(value)
}
