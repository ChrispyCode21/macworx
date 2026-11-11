// "Copy prompt + schema" (SPEC §5.3, §6.10, §7.L): the schema it copies and the checks must agree.
import { describe, expect, it } from 'vitest'
import { checkPassage, PASSAGE_LIMITS } from '../engine'
import { PASSAGE_SCHEMA, passagePrompt } from './passagePrompt'

/**
 * A small JSON Schema matcher for just the keywords the schema uses. Any other keyword throws, so a schema that
 * grows a rule this test can't judge fails here instead of passing unchecked.
 */
const KEYWORDS = [
  'type',
  'required',
  'properties',
  'items',
  'minItems',
  'maxItems',
  'minLength',
  'minimum',
  'maximum',
]
function matches(schema: any, value: unknown): boolean {
  for (const key of Object.keys(schema))
    if (!KEYWORDS.includes(key)) throw new Error(`The test can't judge the schema keyword "${key}"`)
  const { type } = schema
  if (type === 'string') {
    if (typeof value !== 'string') return false
    return schema.minLength === undefined || value.length >= schema.minLength
  }
  if (type === 'integer') {
    if (typeof value !== 'number' || !Number.isInteger(value)) return false
    return value >= (schema.minimum ?? -Infinity) && value <= (schema.maximum ?? Infinity)
  }
  if (type === 'array') {
    if (!Array.isArray(value)) return false
    if (value.length < (schema.minItems ?? 0) || value.length > (schema.maxItems ?? Infinity)) return false
    return value.every((item) => matches(schema.items, item))
  }
  if (type === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
    const object = value as Record<string, unknown>
    if (!(schema.required ?? []).every((key: string) => key in object)) return false
    return Object.entries(schema.properties ?? {}).every(
      ([key, rule]) => !(key in object) || matches(rule, object[key]),
    )
  }
  throw new Error(`The test can't judge the schema type "${String(type)}"`)
}

const question = (over: Record<string, unknown> = {}) => ({
  question: 'What does Mia plant?',
  options: ['A seed', 'A tree', 'A flower', 'A bush'],
  correct_answer: 'A seed',
  ...over,
})
const passage = (over: Record<string, unknown> = {}) => ({
  title: 'The Little Seed',
  minutes: 2,
  passage: ['Mia plants a seed.'],
  questions: [question()],
  ...over,
})
const many = (n: number) => Array.from({ length: n }, () => question())

describe('PASSAGE_SCHEMA', () => {
  it('L24: the schema and the checks accept and refuse the same passages', () => {
    const samples: unknown[] = [
      passage(),
      passage({ topic: 'Story', hint: 'Look for the seed.', grade: 2, settings: { shuffle_options: true } }),
      passage({ questions: [question({ explanation: 'Because.' })] }),
      passage({ minutes: PASSAGE_LIMITS.minutes }),
      passage({ questions: many(PASSAGE_LIMITS.questions) }),
      // Refused by both:
      passage({ title: undefined }),
      passage({ title: '' }),
      passage({ minutes: 0 }),
      passage({ minutes: PASSAGE_LIMITS.minutes + 1 }),
      passage({ minutes: 1.5 }),
      passage({ minutes: '2' }),
      passage({ passage: [] }),
      passage({ passage: [''] }),
      passage({ passage: 'One paragraph as text' }),
      passage({ questions: [] }),
      passage({ questions: many(PASSAGE_LIMITS.questions + 1) }),
      passage({ questions: [question({ options: ['a', 'b', 'c'] })] }),
      passage({ questions: [question({ options: ['a', 'b', 'c', 'd', 'e'], correct_answer: 'a' })] }),
      passage({ questions: [question({ question: '' })] }),
      passage({ questions: [question({ correct_answer: undefined })] }),
      passage({ topic: 5 }),
    ]
    for (const sample of samples)
      expect(matches(PASSAGE_SCHEMA, sample), JSON.stringify(sample).slice(0, 120)).toBe(
        checkPassage(sample).ok,
      )
  })

  it("L24: the rules a schema can't state are in the prompt, and the numbers are the checks' own", () => {
    const prompt = passagePrompt()
    expect(prompt).toContain(JSON.stringify(PASSAGE_SCHEMA, null, 2))
    expect(prompt).toMatch(/exact text of one of them/)
    expect(prompt).toMatch(/blank line/)
    expect(PASSAGE_SCHEMA.properties.minutes.maximum).toBe(PASSAGE_LIMITS.minutes)
    expect(PASSAGE_SCHEMA.properties.questions.maxItems).toBe(PASSAGE_LIMITS.questions)
    expect(PASSAGE_SCHEMA.properties.questions.items.properties.options.minItems).toBe(PASSAGE_LIMITS.options)
  })
})
