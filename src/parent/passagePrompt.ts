// What "Copy prompt + schema" copies (SPEC §5.3, §6.10): the instruction for an AI assistant and the JSON schema of a
// passage. The numbers come from the same limits the checks use, so the two can't drift apart (L24).
import { PASSAGE_LIMITS } from '../engine'

// Text counts as empty when it is only spaces, so a value needs at least one character that is not one (`\S`).
const text = { type: 'string', minLength: 1, pattern: '\\S' } as const
// Optional text may be empty, and null counts as absent.
const optionalText = { type: ['string', 'null'] } as const

/** The shape of one passage as JSON Schema. What a schema can't say is in `passagePrompt`. */
export const PASSAGE_SCHEMA = {
  type: 'object',
  required: ['title', 'minutes', 'passage', 'questions'],
  properties: {
    title: text,
    minutes: { type: 'integer', minimum: 1, maximum: PASSAGE_LIMITS.minutes },
    topic: optionalText,
    hint: optionalText,
    passage: { type: 'array', minItems: 1, items: text },
    questions: {
      type: 'array',
      minItems: 1,
      maxItems: PASSAGE_LIMITS.questions,
      items: {
        type: 'object',
        required: ['question', 'options', 'correct_answer'],
        properties: {
          question: text,
          options: {
            type: 'array',
            minItems: PASSAGE_LIMITS.options,
            maxItems: PASSAGE_LIMITS.options,
            items: text,
          },
          correct_answer: text,
          explanation: optionalText,
        },
      },
    },
  },
} as const

/** The text for the clipboard: what to write, the rules a schema can't hold, then the schema. */
export function passagePrompt(): string {
  return [
    'Write a short reading passage for a child, with comprehension questions, as one JSON object.',
    'Reply with only the JSON, with no markdown fences and no other text.',
    '',
    'Rules:',
    '- "passage" is a list of paragraphs. A paragraph never has a blank line inside it.',
    '- "minutes" is a whole number: how many minutes the passage takes to read.',
    `- Every question has exactly ${PASSAGE_LIMITS.options} different "options", and "correct_answer" is the exact text of one of them.`,
    '- "explanation" is optional: one sentence on why that answer is right.',
    `- No more than ${PASSAGE_LIMITS.questions} questions, and the whole object under 64 KB.`,
    '',
    'JSON schema:',
    JSON.stringify(PASSAGE_SCHEMA, null, 2),
  ].join('\n')
}
