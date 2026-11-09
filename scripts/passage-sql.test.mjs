import { describe, expect, it } from 'vitest'
import { buildPassageSql, checkArgs } from './passage-sql.mjs'

// An invented fixture: nonsense words only, no real passage.
const fixture = () => ({
  title: "Zib's Gloop",
  topic: 'ignored',
  settings: { points_per_question: 99 },
  passage: ['Blorp wex tamu. '.repeat(100).trim(), 'Quin fradle.'],
  questions: [
    {
      number: 1,
      question: 'What is a blorp?',
      options: ['a wex', 'a tamu', 'a quin', 'a fradle'],
      correct_answer: 'a tamu',
      explanation: "It's a tamu.",
    },
    {
      number: 2,
      question: 'Who has a quin?',
      options: ['A', 'B', 'C', 'D'],
      correct_answer: 'C',
      explanation: '',
    },
    { number: 3, question: 'Which one?', options: ['one', 'two', 'three', 'four'], correct_answer: 'four' },
  ],
})

const run = (data, args = {}) => buildPassageSql(data, { id: 7, ...args })
const insertsInto = (sql, table) =>
  sql
    .trimEnd()
    .split(/\n(?=INSERT )/)
    .filter((l) => l.startsWith(`INSERT INTO ${table} `))

describe('buildPassageSql', () => {
  it('writes the passage, questions and choices with deterministic ids', () => {
    const { errors, sql, summary } = run(fixture(), { image: 'webp' })
    expect(errors).toEqual([])
    expect(summary).toEqual({ words: 302, minutes: 3, questions: 3, image: '7.webp' })
    const lines = sql.trimEnd().split(/\n(?=INSERT )/)
    expect(lines.map((l) => l.split(' ')[2])).toEqual([
      'passages',
      ...Array(3).fill('questions'),
      ...Array(12).fill('choices'),
    ])
    expect(lines[0]).toContain("VALUES (7, 'Zib''s Gloop', '', 3, '', 'Blorp")
    expect(lines[0]).toContain("tamu.\n\nQuin fradle.', '7.webp');")
    expect(lines[1]).toContain("(701, 7, 1, 'What is a blorp?', 'It''s a tamu.');")
    expect(lines[3]).toContain("(703, 7, 3, 'Which one?', '');")
    const choices = insertsInto(sql, 'choices')
    for (let q = 1; q <= 3; q++) {
      const mine = choices.filter((l) => l.includes(`, ${700 + q}, `))
      expect(mine).toHaveLength(4)
      mine.forEach((l, p) => expect(l).toContain(`(${(700 + q) * 10 + p + 1}, ${700 + q}, ${p + 1}, `))
      expect(mine.filter((l) => l.endsWith(', 1);'))).toHaveLength(1)
    }
    expect(run(fixture()).sql).toContain(", '', 3, '', 'Blorp")
    expect(run(fixture()).sql).toMatch(/tamu\.\n\nQuin fradle\.', NULL\);/)
  })

  it('keeps the right choice right after shuffling (a letter answer too)', () => {
    const slots = new Set()
    for (let n = 0; n < 40; n++) {
      const choices = insertsInto(run(fixture()).sql, 'choices')
      const rightOf = (q) =>
        choices.filter((l) => l.includes(`, ${700 + q}, `)).find((l) => l.endsWith(', 1);'))
      expect(rightOf(1)).toContain("'a tamu'")
      expect(rightOf(2)).toContain("'C'")
      expect(rightOf(3)).toContain("'four'")
      slots.add(/VALUES \(\d+, \d+, (\d),/.exec(rightOf(3))[1])
    }
    expect(slots.size).toBeGreaterThan(1) // it really moves
  })

  it.each([
    ['not exactly four options', (d) => d.questions[0].options.pop(), 'Question 1: "options"'],
    ['two equal options', (d) => (d.questions[0].options[1] = 'a wex'), 'must all be different'],
    ['no answer matches', (d) => (d.questions[1].correct_answer = 'zzz'), 'matches 0'],
    ['numbers out of order', (d) => (d.questions[2].number = 5), 'Question 3: "number"'],
    ['missing title', (d) => delete d.title, '"title"'],
    ['an empty paragraph', (d) => d.passage.push(' '), '"passage"'],
  ])('refuses %s and writes no SQL', (_name, break_, message) => {
    const data = fixture()
    break_(data)
    const { errors, sql } = run(data)
    expect(sql).toBeNull()
    expect(errors.join('\n')).toContain(message)
  })

  it('reports every problem at once, without quoting the passage', () => {
    const data = fixture()
    delete data.title
    data.questions[0].options.pop()
    data.questions[1].correct_answer = 'zzz'
    const { errors } = buildPassageSql(data, { id: 7 })
    expect(errors).toHaveLength(3)
    expect(errors.join('\n')).not.toMatch(/tamu|blorp|zzz/i)
  })

  it('refuses a bad id or picture extension', () => {
    expect(checkArgs({ id: '3', image: 'webp' })).toEqual([])
    for (const id of ['0', '-1', '1.5', 'x', '9007199254740993', '1000000000000']) {
      expect(checkArgs({ id })).toHaveLength(1)
    }
    expect(checkArgs({ id: '3', image: '.webp' })).toHaveLength(1)
  })
})
