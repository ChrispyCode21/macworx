// Adding spelling words from the parent portal (SPEC §6.11, §7.E): the second look at what the portal checked.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearAccessKeys } from './access'
import { accessToken } from './test/access-keys'
import { createTestDb } from './test/db'

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
