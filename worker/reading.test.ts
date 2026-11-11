// The reading assignment on the Worker (SPEC §5.6, §6.8, §6.10, §7.L). Passages here are tiny stand-ins.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { generateAssignment } from '../src/engine'
import { clearAccessKeys } from './access'
import { accessToken } from './test/access-keys'
import { pickQuestions, postReadingResult } from './reading'
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
      'INSERT INTO questions (id, passage_id, position, text, explanation) VALUES (?, ?, ?, ?, ?)',
      qid,
      id,
      q,
      `Q${q}?`,
      `Because ${q}.`,
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
    expect(JSON.stringify(body)).not.toContain('explanation')
    expect(JSON.stringify(body)).not.toContain('Because')
    // Only an id and its text: nothing else about a choice can carry the answer.
    for (const q of body.passage.questions)
      for (const c of q.choices) expect(Object.keys(c).sort()).toEqual(['id', 'text'])
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
    expect(body.result.questions.map((q: any) => q.explanation)).toEqual(
      Array.from({ length: 10 }, (_, i) => `Because ${i + 1}.`),
    )
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

  it('L9: two submits of one attempt at the same moment record it once', async () => {
    await passage(1)
    const { body } = await start()
    const send = () =>
      t.call('POST', '/api/reading/result', {
        body: { attempt: body.attempt, day: '2026-10-17', picks: picks(body, 3) },
      })
    const both = await Promise.all([send(), send()])
    expect(both.map((r) => r.status).sort()).toEqual([200, 201])
    expect((await first('SELECT COUNT(*) AS n FROM results')).n).toBe(1)
    expect((await first('SELECT balance, completed FROM children WHERE id = 1')).completed).toBe(1)
  })

  it('refuses a result on its way when the iPad is unpaired, and records nothing (SPEC §6.9)', async () => {
    await passage(1)
    const { body } = await start()
    // The key check already passed for device 1; then a parent unpairs it before the write.
    await run("UPDATE devices SET revoked_at = '2026-10-17T12:00:00Z' WHERE id = 1")
    const response = await postReadingResult({
      request: new Request('https://macworx.test/api/reading/result', {
        method: 'POST',
        body: JSON.stringify({ attempt: body.attempt, day: '2026-10-17', picks: picks(body, 3) }),
      }),
      url: new URL('https://macworx.test/api/reading/result'),
      db: t.db,
      device: 1,
      childId: 1,
      now: at('2026-10-17'),
    })
    expect(response.status).toBe(401)
    expect((await first('SELECT COUNT(*) AS n FROM results')).n).toBe(0)
    expect((await first('SELECT balance FROM children WHERE id = 1')).balance).toBe(0)
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
    await run("UPDATE questions SET text = 'Reworded?', explanation = 'Changed.' WHERE id = 101")
    await run('UPDATE choices SET correct = 0 WHERE question_id = 101 AND position = 2')
    await run('UPDATE choices SET correct = 1 WHERE question_id = 101 AND position = 1')
    const id = (await first('SELECT id FROM results WHERE attempt = ?', started.attempt)).id
    const { status, body } = await t.call('GET', `/api/parent/results/${id}`, {
      key: null,
      accessToken: await accessToken(),
    })
    expect(status).toBe(200)
    expect(body.result).toMatchObject({ kind: 'reading', title: 'Story 1', answered: 3, correct: 2 })
    const list = await t.call('GET', '/api/parent/results', { key: null, accessToken: await accessToken() })
    expect(list.body.results[0]).toMatchObject({ id, kind: 'reading', title: 'Story 1' })
    expect(body.result.questions.map((q: any) => q.text)).toEqual(['Q1?', 'Q2?', 'Q3?'])
    expect(body.result.questions.map((q: any) => q.explanation)).toEqual([
      'Because 1.',
      'Because 2.',
      'Because 3.',
    ])
    expect(body.result.questions[0].right).toBe(1012)
    expect(body.result.questions[0].picked).toBe(1012)
    // A snapshot recorded without an explanation (by the Worker running during a deploy) reads as ''.
    await run(
      "UPDATE results SET detail = json_remove(detail, '$.questions[0].explanation') WHERE id = ?",
      id,
    )
    const old = await t.call('GET', `/api/parent/results/${id}`, {
      key: null,
      accessToken: await accessToken(),
    })
    expect(old.body.result.questions[0].explanation).toBe('')
  })
})

describe('L25: an assignment gives at most 10 questions', () => {
  const ids = (body: Record<string, any>) => body.passage.questions.map((q: any) => q.id)

  it('L25: picks exactly k distinct ids, in their original order', () => {
    const all = Array.from({ length: 25 }, (_, i) => i + 1)
    let n = 0
    const picked = pickQuestions(all, 10, () => ((n += 7) % 100) / 100)
    expect(picked).toHaveLength(10)
    expect(new Set(picked).size).toBe(10)
    expect(picked).toEqual([...picked].sort((a, b) => a - b))
    expect(picked.every((id) => all.includes(id))).toBe(true)
    expect(pickQuestions([1, 2, 3], 10, Math.random)).toEqual([1, 2, 3])
  })

  it('L25: the choice follows the random function, not the passage order', () => {
    const all = Array.from({ length: 25 }, (_, i) => i + 1)
    expect(pickQuestions(all, 10, () => 0)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(pickQuestions(all, 10, () => 0.999)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('L25: a 25-question passage hands out 10 of them in the passage order, the same 10 when started again', async () => {
    await passage(1, 25)
    const first1 = (await start()).body
    const shown = ids(first1)
    expect(shown).toHaveLength(10)
    expect(shown).toEqual([...shown].sort((a: number, b: number) => a - b))
    expect(shown.every((id: number) => id >= 101 && id <= 125)).toBe(true)
    const again = (await start(at('2026-10-18'))).body
    expect([again.attempt, ids(again)]).toEqual([first1.attempt, shown])
  })

  it('L25: the result is marked and paid as a 10-question assignment, and keeps only those questions', async () => {
    await passage(1, 25)
    const { status, body } = await finish(10)
    expect(status).toBe(201)
    expect(body.result).toMatchObject({ answered: 10, correct: 10 })
    expect(body.result.payout).toEqual({ base: 20, accuracyBonus: 4, streakBonus: 1, total: 25 })
    const row = await first("SELECT detail FROM results WHERE kind = 'reading'")
    expect(JSON.parse(row.detail).questions).toHaveLength(10)
  })

  it('L25: a pick for a question outside the 10 is refused and nothing is recorded', async () => {
    await passage(1, 25)
    const { body } = await start()
    const shown = ids(body)
    const outside = Array.from({ length: 25 }, (_, i) => 101 + i).find((id) => !shown.includes(id))!
    const wrong = picks(body, 10)
    wrong[0] = { question: outside, choice: outside * 10 + 2 }
    const refused = await t.call('POST', '/api/reading/result', {
      body: { attempt: body.attempt, day: '2026-10-17', picks: wrong },
      now: at('2026-10-17'),
    })
    expect(refused.status).toBe(400)
    expect((await first('SELECT COUNT(*) AS n FROM results')).n).toBe(0)
    // The attempt stays usable.
    const ok = await t.call('POST', '/api/reading/result', {
      body: { attempt: body.attempt, day: '2026-10-17', picks: picks(body, 10) },
      now: at('2026-10-17'),
    })
    expect(ok.status).toBe(201)
  })

  it('L25: 10 questions give all 10 and store nothing; 11 give 10 and store them', async () => {
    await passage(1, 10)
    await passage(2, 11)
    await run(
      "INSERT INTO reading_attempts (device_id, child_id, passage_id, issued_day, used) VALUES (1, 1, 1, 'x', 1)",
    )
    const ten = (await start()).body
    expect(ids(ten)).toHaveLength(10)
    expect(
      (await first('SELECT questions FROM reading_attempts WHERE id = ?', ten.attempt)).questions,
    ).toBeNull()
    await recorded(1)
    const eleven = (await start()).body
    expect(eleven.passage.id).toBe(2)
    expect(ids(eleven)).toHaveLength(10)
    const stored = (await first('SELECT questions FROM reading_attempts WHERE id = ?', eleven.attempt))
      .questions
    expect(JSON.parse(stored)).toEqual(ids(eleven))
  })

  it('L25: when some questions of an unchecked attempt are gone, the next start chooses 10 again and keeps them', async () => {
    await passage(1, 25)
    const first1 = (await start()).body
    const shown = ids(first1)
    for (const gone of [[shown[0]], shown]) {
      await run(
        'UPDATE reading_attempts SET questions = ? WHERE id = ?',
        JSON.stringify(gone.map((id: number) => id + 1000)),
        first1.attempt,
      )
      const again = (await start()).body
      expect(again.attempt).toBe(first1.attempt)
      expect(ids(again)).toHaveLength(10)
      const stored = (await first('SELECT questions FROM reading_attempts WHERE id = ?', again.attempt))
        .questions
      expect(JSON.parse(stored)).toEqual(ids(again))
    }
  })

  it('L25: a passage of 8 questions hands out all 8 and stores no choice', async () => {
    await passage(1, 8)
    const { body } = await start()
    expect(ids(body)).toHaveLength(8)
    expect(
      (await first('SELECT questions FROM reading_attempts WHERE id = ?', body.attempt)).questions,
    ).toBeNull()
  })

  it('L25: an unchecked attempt from before the cap, on a passage of 25, gets its 10 chosen and kept', async () => {
    await passage(1, 25)
    const made = await run(
      "INSERT INTO reading_attempts (device_id, child_id, passage_id, issued_day) VALUES (1, 1, 1, '2026-10-01')",
    )
    const { body } = await start()
    expect(body.attempt).toBe(made.meta.last_row_id)
    expect(ids(body)).toHaveLength(10)
    const stored = (await first('SELECT questions FROM reading_attempts WHERE id = ?', body.attempt))
      .questions
    expect(JSON.parse(stored)).toEqual(ids(body))
  })
})
