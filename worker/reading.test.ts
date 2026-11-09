// The reading assignment on the Worker (SPEC §5.6, §6.8, §6.10, §7.L). Passages here are tiny stand-ins.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { generateAssignment } from '../src/engine'
import { clearAccessKeys } from './access'
import { accessToken } from './test/access-keys'
import { createTestDb } from './test/db'

let t: Awaited<ReturnType<typeof createTestDb>>
beforeEach(async () => {
  clearAccessKeys()
  t = await createTestDb()
})
afterEach(async () => {
  await t.dispose()
})

const at = (day: string) => new Date(`${day}T12:00:00Z`)
const run = (sql: string, ...values: unknown[]) =>
  t.db
    .prepare(sql)
    .bind(...values)
    .run()
const first = (sql: string, ...values: unknown[]) =>
  t.db
    .prepare(sql)
    .bind(...values)
    .first<any>()

/** A passage with `n` questions of `choices` choices each; the right choice of every question is its second. */
async function passage(id: number, n = 3, choices = 4) {
  await run(
    'INSERT INTO passages (id, title, minutes, body) VALUES (?, ?, 1, ?)',
    id,
    `Story ${id}`,
    'One.\n\nTwo.',
  )
  for (let q = 1; q <= n; q++) {
    const qid = id * 100 + q
    await run(
      'INSERT INTO questions (id, passage_id, position, text) VALUES (?, ?, ?, ?)',
      qid,
      id,
      q,
      `Q${q}?`,
    )
    for (let c = 1; c <= choices; c++)
      await run(
        'INSERT INTO choices (id, question_id, position, text, correct) VALUES (?, ?, ?, ?, ?)',
        qid * 10 + c,
        qid,
        c,
        `c${c}`,
        c === 2 ? 1 : 0,
      )
  }
}

const start = (now = at('2026-10-17')) => t.call('POST', '/api/reading/start', { now })

/** Picks for a started passage: the first `right` questions right, the rest wrong. */
const picks = (body: Record<string, any>, right: number) =>
  body.passage.questions.map((q: any, i: number) => ({
    question: q.id,
    choice: q.choices[i < right ? 1 : 0].id,
  }))

async function finish(right: number, day = '2026-10-17', now = at(day)) {
  const { body } = await start(now)
  const done = await t.call('POST', '/api/reading/result', {
    body: { attempt: body.attempt, day, picks: picks(body, right) },
    now,
  })
  return { started: body, ...done }
}

/** A finished reading result recorded straight into the database, for testing the order passages come in. */
async function recorded(passageId: number) {
  const made = await run(
    "INSERT INTO reading_attempts (device_id, child_id, passage_id, issued_day, used) VALUES (1, 1, ?, '2026-10-01', 1)",
    passageId,
  )
  await run(
    `INSERT INTO results (kind, attempt, detail, device_id, child_id, day, answers, answered, correct, finished, grade, base,
     accuracy_bonus, streak_bonus, total, created_at) VALUES ('reading', ?, '{}', 1, 1, '2026-10-01', '[]', 3, 3, 1, 'Excellent', 20, 4, 0, 24, 'x')`,
    made.meta.last_row_id,
  )
}

describe('POST /api/reading/start', () => {
  it('L6: her next passage is the lowest she has not finished', async () => {
    for (const id of [1, 2, 3]) await passage(id)
    await recorded(1)
    await recorded(2)
    expect((await start()).body.passage.id).toBe(3)
  })

  it('L7: with every passage finished, the one recorded longest ago comes next', async () => {
    for (const id of [1, 2, 3]) await passage(id)
    // Their latest finished results were recorded in the order 2, 3, 1.
    for (const id of [2, 3, 1]) await recorded(id)
    expect((await start()).body.passage.id).toBe(2)
  })

  it('never hands out a passage that is not complete', async () => {
    await passage(1, 3, 3) // three choices a question
    await passage(2)
    await passage(3, 0) // no questions
    await run('UPDATE choices SET correct = 0 WHERE question_id = 201') // no right choice in one question
    await passage(4)
    expect((await start()).body.passage.id).toBe(4)
  })

  it('L8: leaving before Check records nothing, and the next start gives the same passage and attempt, dated again', async () => {
    await passage(1)
    await passage(2)
    const first1 = (await start(at('2026-10-17'))).body
    const again = (await start(at('2026-10-18'))).body
    expect([again.passage.id, again.attempt]).toEqual([first1.passage.id, first1.attempt])
    expect((await first('SELECT COUNT(*) AS n FROM results')).n).toBe(0)
    expect(
      (await first('SELECT issued_day FROM reading_attempts WHERE id = ?', again.attempt)).issued_day,
    ).toBe('2026-10-18')
  })

  it('L12: never says which choice is right, and splits the text into paragraphs', async () => {
    await passage(1)
    const { body } = await start()
    expect(JSON.stringify(body)).not.toContain('correct')
    expect(body.passage.paragraphs).toEqual(['One.', 'Two.'])
    expect(body.passage.questions[0].choices).toHaveLength(4)
  })

  it('L15: with no passages there is no passage', async () => {
    expect((await start()).body).toEqual({ passage: null })
  })
})

describe('POST /api/reading/result', () => {
  it('marks, pays and records a result: 8 of 10 right is 16 + 3 + 1 streak', async () => {
    await passage(1, 10)
    const { status, started, body } = await finish(8)
    expect(status).toBe(201)
    expect(body.result.correct).toBe(8)
    expect(body.result.payout).toEqual({ base: 16, accuracyBonus: 3, streakBonus: 1, total: 20 })
    expect(body.result.questions.filter((q: any) => q.right)).toHaveLength(8)
    expect(body.state).toMatchObject({ balance: 20, streak: 1, completed: 1, latestGrade: 'Good' })
    const row = await first("SELECT * FROM results WHERE kind = 'reading'")
    expect(row).toMatchObject({
      seed: null,
      attempt: started.attempt,
      answered: 10,
      correct: 8,
      finished: 1,
      total: 20,
    })
    expect(JSON.parse(row.detail).title).toBe('Story 1')
    expect((await first('SELECT used FROM reading_attempts WHERE id = ?', started.attempt)).used).toBe(1)
  })

  it('L9: the same attempt twice is recorded once', async () => {
    await passage(1)
    const { started, body } = await finish(3)
    const again = await t.call('POST', '/api/reading/result', {
      body: { attempt: started.attempt, day: '2026-10-17', picks: picks(started, 3) },
    })
    expect(again.status).toBe(200)
    expect(again.body.result).toEqual(body.result)
    expect(again.body.state.balance).toBe(body.state.balance)
    expect((await first('SELECT COUNT(*) AS n FROM results')).n).toBe(1)
  })

  it('L10: after math earlier today the reading result takes no streak bonus and leaves the streak', async () => {
    await passage(1)
    await run(
      "UPDATE children SET streak = 3, last_day = '2026-10-17', completed = 1, balance = 27 WHERE id = 1",
    )
    const { body } = await finish(3)
    expect(body.result.payout).toEqual({ base: 20, accuracyBonus: 4, streakBonus: 0, total: 24 })
    expect(body.state).toMatchObject({ balance: 51, streak: 3, completed: 2 })
  })

  it('L11: a reading result after a math Excellent makes the latest grade Improving and counts as completed', async () => {
    await passage(1)
    const seeds = await t.call('POST', '/api/seeds')
    const seed = seeds.body.seeds[0]
    await t.call('POST', '/api/results', {
      body: { seed, day: '2026-10-17', answers: generateAssignment(seed).map((p) => p.answer) },
    })
    const { body } = await finish(2)
    expect(body.state).toMatchObject({ latestGrade: 'Improving', completed: 2 })
  })

  it('L16: a day out of range is recorded on the nearest valid day and does not touch the streak', async () => {
    await passage(1)
    const { body } = await finish(3, '2026-10-19', at('2026-10-17'))
    expect(body.result.day).toBe('2026-10-18')
    expect(body.result.payout).toEqual({ base: 20, accuracyBonus: 4, streakBonus: 0, total: 24 })
    expect(body.state).toMatchObject({ streak: 0, lastDay: null, completed: 1 })
  })

  it("L14: choices that miss a question or name another question's choice are refused and nothing is recorded", async () => {
    await passage(1)
    const { body } = await start()
    const good = picks(body, 3)
    const send = (p: unknown) =>
      t.call('POST', '/api/reading/result', { body: { attempt: body.attempt, day: '2026-10-17', picks: p } })
    expect((await send(good.slice(1))).status).toBe(400)
    expect((await send([good[0], good[0], good[2]])).status).toBe(400)
    expect((await send([{ ...good[0], choice: good[1].choice }, good[1], good[2]])).status).toBe(400)
    expect((await send(Array(51).fill(good[0]))).status).toBe(400)
    expect((await first('SELECT COUNT(*) AS n FROM results')).n).toBe(0)
    expect((await send(good)).status).toBe(201)
  })

  it("refuses an attempt that is not this device's child's", async () => {
    await passage(1)
    const { body } = await start()
    const other = await t.call('POST', '/api/reading/result', {
      body: { attempt: body.attempt, day: '2026-10-17', picks: picks(body, 3) },
      key: 'child2-device-key-0123456789abcdef',
    })
    expect(other).toMatchObject({ status: 404 })
  })
})

describe('keys and the parent view', () => {
  it('L13: both routes need the device key', async () => {
    for (const path of ['/api/reading/start', '/api/reading/result'])
      for (const key of [null, 'not-a-key'])
        expect((await t.call('POST', path, { key, body: {} })).status).toBe(401)
  })

  it('D14: a parent opens a reading result as it was recorded, after the passage is edited', async () => {
    await passage(1)
    const { started } = await finish(2)
    await run("UPDATE passages SET title = 'Renamed' WHERE id = 1")
    await run("UPDATE questions SET text = 'Reworded?' WHERE id = 101")
    await run('UPDATE choices SET correct = 0 WHERE question_id = 101 AND position = 2')
    await run('UPDATE choices SET correct = 1 WHERE question_id = 101 AND position = 1')
    const id = (await first('SELECT id FROM results WHERE attempt = ?', started.attempt)).id
    const { status, body } = await t.call('GET', `/api/parent/results/${id}`, {
      key: null,
      accessToken: await accessToken(),
    })
    expect(status).toBe(200)
    expect(body.result).toMatchObject({ kind: 'reading', title: 'Story 1', answered: 3, correct: 2 })
    expect(body.result.questions.map((q: any) => q.text)).toEqual(['Q1?', 'Q2?', 'Q3?'])
    expect(body.result.questions[0].right).toBe(1012)
    expect(body.result.questions[0].picked).toBe(1012)
  })
})
