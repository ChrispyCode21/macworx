// The rules for a pasted reading passage (SPEC §6.10, §7.L).
import { describe, expect, it } from 'vitest'
import { checkPassage, parsePassageJson, PASSAGE_LIMITS } from './passage'

const question = (over: Record<string, unknown> = {}) => ({
  question: 'What does Mia plant?',
  options: ['A seed', 'A tree', 'A flower', 'A bush'],
  correct_answer: 'A seed',
  explanation: 'Mia plants a seed.',
  ...over,
})
const passage = (over: Record<string, unknown> = {}) => ({
  title: 'The Little Seed',
  minutes: 2,
  passage: ['Mia plants a seed.', 'She waters it.'],
  questions: [question()],
  ...over,
})
const problems = (value: unknown) => {
  const result = checkPassage(value)
  return result.ok ? [] : result.problems
}

describe('checkPassage', () => {
  it('L18: accepts a passage with four different options and a correct answer equal to one of them', () => {
    const result = checkPassage(passage({ topic: 'Story', hint: 'Look for the seed.' }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.passage).toMatchObject({
      title: 'The Little Seed',
      minutes: 2,
      paragraphs: ['Mia plants a seed.', 'She waters it.'],
      genre: 'Story',
      hint: 'Look for the seed.',
    })
    expect(result.passage.questions[0]).toEqual({
      text: 'What does Mia plant?',
      options: ['A seed', 'A tree', 'A flower', 'A bush'],
      answer: 0,
      explanation: 'Mia plants a seed.',
    })
  })

  it('L19: a question with three options, or a correct answer that matches none, is refused in plain words', () => {
    expect(
      problems(passage({ questions: [question({ options: ['A', 'B', 'C'], correct_answer: 'A' })] })),
    ).toEqual(['Question 1 needs exactly 4 "options" (it has 3).'])
    expect(problems(passage({ questions: [question(), question({ correct_answer: 'A bird' })] }))).toEqual([
      'Question 2\'s "correct_answer" isn\'t one of its options.',
    ])
  })

  it('L19: a correct answer that matches two options is two right answers; other repeats are named too', () => {
    const twice = question({ options: ['A seed', 'A seed', 'A tree', 'A bush'] })
    expect(problems(passage({ questions: [question(), question(), question(), twice] }))).toEqual([
      'Question 4 has two right answers.',
    ])
    const same = question({ options: ['A tree', 'A tree', 'A seed', 'A bush'] })
    expect(problems(passage({ questions: [same] }))).toEqual([
      'Question 1 has two options that are the same.',
    ])
  })

  it('L19: no minutes, no title, no paragraphs or no questions is refused, and over 50 questions too', () => {
    expect(problems(passage({ minutes: undefined }))).toEqual([
      'The passage needs "minutes", a whole number of at least 1.',
    ])
    expect(problems(passage({ minutes: 1.5 }))).toHaveLength(1)
    expect(problems(passage({ title: '  ' }))).toEqual(['The passage needs a "title".'])
    expect(problems(passage({ passage: [] }))).toHaveLength(1)
    expect(problems(passage({ questions: [] }))).toHaveLength(1)
    const many = Array.from({ length: PASSAGE_LIMITS.questions + 1 }, () => question())
    expect(problems(passage({ questions: many }))).toEqual([
      'The passage needs between 1 and 50 "questions".',
    ])
    expect(checkPassage(passage({ questions: many.slice(0, 50) })).ok).toBe(true)
  })

  it('L19: reports every problem at once, and says what to paste when it is not an object', () => {
    const all = problems(
      passage({ title: '', questions: [question({ correct_answer: 'x' }), question({ options: [] })] }),
    )
    expect(all).toHaveLength(3)
    expect(problems([1, 2])).toEqual(['Paste one JSON object, starting with { and ending with }.'])
  })

  it('L20: keeps every pasted field, including settings, and reads none of them as rules', () => {
    const pasted = passage({
      type: 'reading_comprehension',
      grade: 2,
      image_prompt: 'A girl on a beam',
      settings: { shuffle_options: true, points_per_question: 5, passing_score: 7 },
    })
    const result = checkPassage(pasted)
    expect(result.ok && result.passage.source).toEqual(pasted)
    expect(result.ok && result.passage.questions[0]!.options).toEqual([
      'A seed',
      'A tree',
      'A flower',
      'A bush',
    ])
  })
})

describe('parsePassageJson', () => {
  it('turns text that is not JSON into a plain sentence, and checks the passage when it is', () => {
    const bad = parsePassageJson('{ "title": ')
    expect(bad.ok === false && bad.problems[0]).toMatch(/isn't valid JSON/)
    expect(parsePassageJson(JSON.stringify(passage())).ok).toBe(true)
  })

  it('L19: refuses over 64 KB', () => {
    const big = JSON.stringify(passage({ pad: 'x'.repeat(PASSAGE_LIMITS.bytes) }))
    const result = parsePassageJson(big)
    expect(result.ok === false && result.problems[0]).toMatch(/64 KB/)
  })
})
