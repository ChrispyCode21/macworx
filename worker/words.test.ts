// Adding spelling words from the parent portal (SPEC §6.11, §7.E): the second look at what the portal checked.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearAccessKeys } from './access'
import { accessToken } from './test/access-keys'
import { createTestDb } from './test/db'
import { patchWord } from './words'

let t: Awaited<ReturnType<typeof createTestDb>>
let token: string
beforeEach(async () => {
  clearAccessKeys()
  t = await createTestDb()
  token = await accessToken()
})
afterEach(async () => {
  await t.dispose()
})

const post = (body: unknown) => t.call('POST', '/api/parent/words', { key: null, accessToken: token, body })
const add = (...words: unknown[]) => post({ words })
const stored = async () =>
  (await t.db.prepare('SELECT word, key, sentence, alternates, grade FROM words ORDER BY id').all<any>())
    .results

describe('POST /api/parent/words', () => {
  it('adds words with their sentences, alternates and grade, and says how many', async () => {
    const { status, body } = await add(
      { word: 'because' },
      { word: 'favourite', alternates: ['favorite'], grade: 2 },
      { word: 'their', sentence: 'They ate their dinner.' },
    )
    expect([status, body]).toEqual([201, { added: 3, skipped: 0 }])
    expect(await stored()).toEqual([
      { word: 'because', key: 'because', sentence: '', alternates: '[]', grade: null },
      { word: 'favourite', key: 'favourite', sentence: '', alternates: '["favorite"]', grade: 2 },
      { word: 'their', key: 'their', sentence: 'They ate their dinner.', alternates: '[]', grade: null },
    ])
  })

  it('E17: a word already in the list is skipped, ignoring capitals, and the result says so', async () => {
    await add({ word: 'friend' })
    const { status, body } = await add({ word: 'Friend' })
    expect([status, body]).toEqual([201, { added: 0, skipped: 1 }])
    expect(await stored()).toHaveLength(1)
    // The same word with another apostrophe or accent form is the same word, as in her typing.
    await add({ word: 'don’t' }, { word: 'café' })
    expect((await add({ word: "don't" }, { word: 'café' })).body).toEqual({ added: 0, skipped: 2 })
  })

  it('skips a word repeated inside one save, and counts it as skipped', async () => {
    const { body } = await add({ word: 'again' }, { word: 'AGAIN' }, { word: 'other' })
    expect(body).toEqual({ added: 2, skipped: 1 })
    expect((await stored()).map((r) => r.word)).toEqual(['again', 'other'])
  })

  it('E20: a save with a word the checks refuse is a 400 with the problems, and nothing is saved', async () => {
    const { status, body } = await add({ word: 'good' }, { word: 'ice cream' }, { word: 'r2d2' })
    expect(status).toBe(400)
    expect(body.error).toBe('bad_word')
    expect(body.problems).toEqual([
      'The word "ice cream" can only have letters, apostrophes and hyphens.',
      'The word "r2d2" can only have letters, apostrophes and hyphens.',
    ])
    expect(await stored()).toEqual([])
  })

  it('E20: refuses a grade that is not a whole number from 0 to 99, an entry that is not an object, and bad bodies', async () => {
    for (const bad of [
      { word: 'a', grade: 1.5 },
      { word: 'a', grade: 100 },
      { word: 'a', grade: '2' },
      null,
      7,
    ])
      expect((await add(bad)).status).toBe(400)
    expect((await post({ nope: 1 })).status).toBe(400)
    expect((await post('text')).status).toBe(400)
    expect(await stored()).toEqual([])
  })

  it('takes 500 words in one save and refuses 501', async () => {
    // Distinct words made only of letters: w, then i written in base 26 with letters.
    const letters = (i: number) => {
      let out = ''
      let n = i
      do {
        out = String.fromCharCode(97 + (n % 26)) + out
        n = Math.floor(n / 26)
      } while (n > 0)
      return `w${out}`
    }
    const words = Array.from({ length: 500 }, (_, i) => ({ word: letters(i) }))
    expect((await add(...words)).body).toEqual({ added: 500, skipped: 0 })
    const over = await add(...words, { word: 'one' })
    expect([over.status, over.body.error]).toEqual([400, 'bad_word'])
  })

  it('an alternate that is another word is allowed, and an empty list adds nothing', async () => {
    expect((await add({ word: 'colour', alternates: ['color'] }, { word: 'color' })).body).toEqual({
      added: 2,
      skipped: 0,
    })
    expect((await add()).body).toEqual({ added: 0, skipped: 0 })
  })

  it('a word repeated in one save is one word: the first sentence, every alternate, and the repeats are skipped', async () => {
    const { body } = await add(
      { word: 'favourite' },
      { word: 'Favourite', sentence: 'My favourite colour.', alternates: ['favorite'], grade: 3 },
      { word: 'favourite', alternates: ['favorite', 'favourit\u00e9'] },
    )
    expect(body).toEqual({ added: 1, skipped: 2 })
    expect(await stored()).toEqual([
      {
        word: 'favourite',
        key: 'favourite',
        sentence: 'My favourite colour.',
        alternates: '["favorite","favourit\u00e9"]',
        grade: 3,
      },
    ])
  })

  it('E20: refuses a word she could not type back (a ligature, a full-width letter, an invisible mark)', async () => {
    for (const word of ['\ufb01sh', '\uff46ish', 'fi\u034Fsh', 'fi\u00adsh']) {
      const { status, body } = await add({ word })
      expect([status, body.error]).toEqual([400, 'bad_word'])
    }
    expect(await stored()).toEqual([])
  })

  it('counts the size in bytes, not characters, and refuses a request that says it is too big', async () => {
    // 500 sentences of 200 three-byte characters: about 100,000 characters, but over 256 KB as bytes.
    const sentence = '\u4e16'.repeat(200)
    const words = Array.from({ length: 500 }, (_, i) => ({
      word: `w${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`,
      sentence,
      alternates: [] as string[],
    }))
    const text = JSON.stringify({ words })
    expect(text.length).toBeLessThan(256 * 1024)
    expect(new TextEncoder().encode(text).length).toBeGreaterThan(256 * 1024)
    const response = await post(JSON.parse(text))
    expect([response.status, response.body.error]).toEqual([400, 'bad_word'])
    expect(await stored()).toEqual([])
  })

  it('lists at most 10 problems and counts the rest, and names the grade range', async () => {
    const many = Array.from({ length: 13 }, (_, i) => ({ word: `bad ${i}` }))
    const { body } = await add(...many)
    expect(body.problems).toHaveLength(11)
    expect(body.problems[10]).toBe('\u2026and 3 more to fix.')
    expect((await add({ word: 'a', grade: 100 })).body.problems).toEqual([
      'The grade for "a" has to be a whole number from 0 to 99.',
    ])
  })

  it('needs an Access token like every parent route', async () => {
    const { status } = await t.call('POST', '/api/parent/words', {
      key: null,
      body: { words: [{ word: 'a' }] },
    })
    expect(status).toBe(401)
    expect(await stored()).toEqual([])
  })
})

const call = (method: string, path: string, body?: unknown) =>
  t.call(method, path, { key: null, accessToken: token, body })
const idOf = async (word: string) =>
  (await t.db.prepare('SELECT id FROM words WHERE word = ?').bind(word).first<{ id: number }>())!.id

describe('GET /api/parent/words', () => {
  it('lists every word alphabetically, ignoring capitals, with its sentence, alternates and grade', async () => {
    await add(
      { word: 'zebra' },
      { word: 'Apple' },
      { word: '\u00e9cole' },
      { word: 'favourite', alternates: ['favorite'], sentence: 'My favourite.', grade: 2 },
      { word: 'banana' },
    )
    const { status, body } = await call('GET', '/api/parent/words')
    expect(status).toBe(200)
    expect(body.words.map((w: any) => w.word)).toEqual([
      'Apple',
      'banana',
      '\u00e9cole',
      'favourite',
      'zebra',
    ])
    expect(body.words[3]).toMatchObject({ alternates: ['favorite'], sentence: 'My favourite.', grade: 2 })
    expect(typeof body.words[0].id).toBe('number')
  })

  it('is empty before any word is added, and needs Access', async () => {
    expect((await call('GET', '/api/parent/words')).body).toEqual({ words: [] })
    expect((await t.call('GET', '/api/parent/words', { key: null })).status).toBe(401)
  })
})

describe('PATCH /api/parent/words/:id', () => {
  it('changes each field sent and leaves the others as they were', async () => {
    await add({ word: 'colour', sentence: 'A bright colour.', alternates: ['color'], grade: 1 })
    const id = await idOf('colour')
    const edit = (body: unknown) => call('PATCH', `/api/parent/words/${id}`, body)
    expect((await edit({ sentence: 'Pick a colour.' })).body.word).toEqual({
      id,
      word: 'colour',
      sentence: 'Pick a colour.',
      alternates: ['color'],
      grade: 1,
    })
    expect((await edit({ alternates: [] })).body.word.alternates).toEqual([])
    expect((await edit({ grade: null })).body.word.grade).toBeNull()
    const renamed = await edit({ word: 'Colours' })
    expect([renamed.status, renamed.body.word.word]).toEqual([200, 'Colours'])
    expect(await stored()).toEqual([
      { word: 'Colours', key: 'colours', sentence: 'Pick a colour.', alternates: '[]', grade: null },
    ])
  })

  it('an empty sentence stores none, and a new word equal to an alternate drops that alternate', async () => {
    await add({ word: 'colour', sentence: 'A bright colour.', alternates: ['color', 'colr'] })
    const id = await idOf('colour')
    const edit = (body: unknown) => call('PATCH', `/api/parent/words/${id}`, body)
    expect((await edit({ sentence: '  ' })).body.word.sentence).toBe('')
    expect((await edit({ word: 'color' })).body.word).toMatchObject({ word: 'color', alternates: ['colr'] })
  })

  it('a word with other capitals is the same word, not a clash; another word with the key is 409', async () => {
    await add({ word: 'friend' }, { word: 'other' })
    const friend = await idOf('friend')
    expect((await call('PATCH', `/api/parent/words/${friend}`, { word: 'Friend' })).status).toBe(200)
    const clash = await call('PATCH', `/api/parent/words/${friend}`, { word: 'OTHER' })
    expect([clash.status, clash.body.error]).toEqual([409, 'duplicate'])
    expect((await stored()).map((r) => r.word)).toEqual(['Friend', 'other'])
  })

  it('refuses a word the checks refuse, an empty body, a bad grade and a body that is not an object', async () => {
    await add({ word: 'one' })
    const id = await idOf('one')
    const edit = (body: unknown) => call('PATCH', `/api/parent/words/${id}`, body)
    const bad = await edit({ word: 'ice cream' })
    expect([bad.status, bad.body.error]).toEqual([400, 'bad_word'])
    for (const body of [{}, { nope: 1 }, [], 'x', { grade: 100 }, { alternates: 'color' }])
      expect((await edit(body)).status, JSON.stringify(body)).toBe(400)
    expect((await stored())[0]).toMatchObject({ word: 'one', grade: null })
  })

  it('an unknown id is 404 unknown_word, and it needs Access', async () => {
    const missing = await call('PATCH', '/api/parent/words/999', { sentence: 'x' })
    expect([missing.status, missing.body.error]).toEqual([404, 'unknown_word'])
    expect(
      (await t.call('PATCH', '/api/parent/words/1', { key: null, body: { sentence: 'x' } })).status,
    ).toBe(401)
  })

  it('a rename onto a word that matches as her typing does is 409: another apostrophe or accent form', async () => {
    await add({ word: "don't" }, { word: 'café' }, { word: 'other' }, { word: 'more' })
    const other = await idOf('other')
    const more = await idOf('more')
    for (const word of ['don’t', 'café'])
      expect((await call('PATCH', `/api/parent/words/${other}`, { word })).status, word).toBe(409)
    expect((await call('PATCH', `/api/parent/words/${more}`, { sentence: 'Fine.' })).status).toBe(200)
  })

  it('only the fields sent are written, and a body over 256 KB is refused', async () => {
    await add({ word: 'colour', sentence: 'First.', alternates: ['color'] })
    const id = await idOf('colour')
    await call('PATCH', `/api/parent/words/${id}`, { grade: 4 })
    await call('PATCH', `/api/parent/words/${id}`, { sentence: 'Second.' })
    expect((await stored())[0]).toMatchObject({ sentence: 'Second.', alternates: '["color"]', grade: 4 })
    const big = await call('PATCH', `/api/parent/words/${id}`, { sentence: 'x'.repeat(300_000) })
    expect([big.status, big.body.error]).toEqual([400, 'bad_word'])
  })

  it('a word deleted between the read and the write is 404, not a 200 for a change that was not made', async () => {
    await add({ word: 'alpha' })
    const alpha = await idOf('alpha')
    const real = t.db
    const db = new Proxy(real, {
      get: (target, prop) => {
        if (prop !== 'prepare')
          return typeof (target as any)[prop] === 'function'
            ? (target as any)[prop].bind(target)
            : (target as any)[prop]
        return (sql: string) => {
          if (sql.startsWith('UPDATE words')) void target.prepare('DELETE FROM words').run()
          return target.prepare(sql)
        }
      },
    })
    const response = await patchWord({
      request: new Request('https://x/api/parent/words/1', {
        method: 'PATCH',
        body: JSON.stringify({ sentence: 'x' }),
      }),
      url: new URL('https://x/api/parent/words/1'),
      db,
      email: 'p@example.com',
      now: new Date('2026-10-17T12:00:00Z'),
      params: { id: String(alpha) },
    } as Parameters<typeof patchWord>[0])
    expect([response.status, ((await response.json()) as { error: string }).error]).toEqual([
      404,
      'unknown_word',
    ])
  })

  it('a clash that lands between the check and the write is 409, not a 500', async () => {
    await add({ word: 'alpha' }, { word: 'beta' })
    const alpha = await idOf('alpha')
    // The look for another word with the key finds none, then the write meets the unique key.
    const real = t.db
    const db = new Proxy(real, {
      get: (target, prop) => {
        if (prop !== 'prepare')
          return typeof (target as any)[prop] === 'function'
            ? (target as any)[prop].bind(target)
            : (target as any)[prop]
        return (sql: string) =>
          sql.startsWith('SELECT id FROM words WHERE key')
            ? { bind: () => ({ first: async () => null }) }
            : target.prepare(sql)
      },
    })
    const response = await patchWord({
      request: new Request('https://x/api/parent/words/1', {
        method: 'PATCH',
        body: JSON.stringify({ word: 'beta' }),
      }),
      url: new URL('https://x/api/parent/words/1'),
      db,
      email: 'p@example.com',
      now: new Date('2026-10-17T12:00:00Z'),
      params: { id: String(alpha) },
    } as Parameters<typeof patchWord>[0])
    expect([response.status, ((await response.json()) as { error: string }).error]).toEqual([
      409,
      'duplicate',
    ])
  })
})

describe('DELETE /api/parent/words/:id', () => {
  it('removes the word, and then it is gone: a second delete is 404', async () => {
    await add({ word: 'one' }, { word: 'two' })
    const one = await idOf('one')
    expect(await call('DELETE', `/api/parent/words/${one}`)).toMatchObject({
      status: 200,
      body: { ok: true },
    })
    expect((await stored()).map((r) => r.word)).toEqual(['two'])
    const again = await call('DELETE', `/api/parent/words/${one}`)
    expect([again.status, again.body.error]).toEqual([404, 'unknown_word'])
  })

  it('a deleted word can be added again, and it needs Access', async () => {
    await add({ word: 'again' })
    await call('DELETE', `/api/parent/words/${await idOf('again')}`)
    expect((await add({ word: 'again' })).body).toEqual({ added: 1, skipped: 0 })
    expect((await t.call('DELETE', '/api/parent/words/1', { key: null })).status).toBe(401)
  })
})
