import { useEffect, useMemo, useRef, useState } from 'react'
import { COPY } from '../../copy'
import { checkWord, parseWords, SPELLING, wordAdvice } from '../../engine'
import type { WordAdvice, WordEntry } from '../../engine'
import { loadDictionaries } from '../../parent/dictionary'
import type { Dictionaries } from '../../parent/dictionary'
import { addWords } from '../../parent/api'
import type { ParentResult } from '../../parent/api'

export interface WordsNote {
  tone: 'info' | 'warn'
  text: string
}

/** What a failed save shows. While the page reloads for a sign-in, nothing. */
function failure(result: Extract<ParentResult<unknown>, { ok: false }>): string | null {
  if (result.error === 'reloading') return null
  if (result.error === 'signed_out') return COPY.parentSignedOut
  if (result.error === 'offline') return COPY.parentOffline
  // The portal ran the same checks before sending, so a refusal here is rare and its detail adds nothing.
  if (result.error === 'bad_word') return COPY.wordsSaveProblem
  return COPY.parentServerTrouble
}

/** What the dictionary check says about one word in the box, and the other spelling the parent has added for it. */
export interface WordAdviceItem {
  word: string
  advice: Exclude<WordAdvice, { kind: 'none' }>
  /** The offered other spelling once the parent has added it. */
  added: boolean
}

/** Typing pauses this long before the words are looked up, so half-typed words get no advice. */
const LOOK_UP_AFTER_MS = 400

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/** The most problems listed at once; the rest are counted. */
const MAX_LISTED = 10

/**
 * The state of the Content screen's word list (SPEC §5.3). It lives in the Portal, so the pasted words and a save in
 * flight survive a visit to another tab, and Save can't be sent twice.
 */
export function useWordsForm() {
  const [draft, setDraftState] = useState('')
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState<WordsNote | null>(null)
  const latest = useRef('')
  const busy = useRef(false)

  const entries: WordEntry[] = useMemo(() => parseWords(draft), [draft])

  // The dictionary check (SPEC §6.11): loaded the first time a word is typed, advice only.
  const [dictionaries, setDictionaries] = useState<Dictionaries | null>(null)
  const [settled, setSettled] = useState<WordEntry[]>([])
  const [accepted, setAccepted] = useState<Record<string, string>>({})
  const asked = useRef(new Map<string, WordAdvice>())
  useEffect(() => {
    if (entries.length === 0) {
      setSettled([])
      return
    }
    const timer = setTimeout(() => setSettled(entries), LOOK_UP_AFTER_MS)
    return () => clearTimeout(timer)
  }, [entries])
  const wanted = settled.length > 0
  useEffect(() => {
    if (!wanted || dictionaries) return
    let live = true
    void loadDictionaries().then((found) => live && found && setDictionaries(found))
    return () => {
      live = false
    }
  }, [wanted, dictionaries])
  const advice: WordAdviceItem[] = useMemo(() => {
    if (!dictionaries) return []
    const items: WordAdviceItem[] = []
    const seen = new Set<string>()
    for (const entry of settled) {
      const key = entry.word.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      let said = asked.current.get(key)
      if (!said) {
        said = wordAdvice(entry.word, dictionaries.us, dictionaries.uk)
        asked.current.set(key, said)
      }
      if (said.kind === 'none') continue
      // An alternate already on the line counts as added; nothing is offered for it.
      if (said.kind === 'only' && said.other && entry.alternates.some((a) => same(a, said.other!))) continue
      items.push({ word: entry.word, advice: said, added: key in accepted })
    }
    return items
  }, [dictionaries, settled, accepted])
  const addAlternate = (word: string, other: string) =>
    setAccepted((a) => ({ ...a, [word.toLowerCase()]: other }))
  const removeAlternate = (word: string) =>
    setAccepted((a) => {
      const { [word.toLowerCase()]: _gone, ...rest } = a
      return rest
    })
  // Every entry through the same checks the Worker runs, so a save the portal sends is one the Worker accepts.
  const problems = useMemo(() => {
    const all: string[] = []
    // The limits of one save, so the parent hears about them here and not as a refusal after pressing Save.
    if (entries.length > SPELLING.perSave) all.push(COPY.wordsTooMany(SPELLING.perSave))
    else if (
      draft.length > SPELLING.saveBytes / 4 &&
      new TextEncoder().encode(JSON.stringify({ words: entries })).length > SPELLING.saveBytes
    )
      all.push(COPY.wordsTooBig)
    for (const entry of entries) {
      const checked = checkWord(entry)
      if (!checked.ok) all.push(...checked.problems)
    }
    return all.length > MAX_LISTED
      ? [...all.slice(0, MAX_LISTED), COPY.wordsMoreProblems(all.length - MAX_LISTED)]
      : all
  }, [draft, entries])

  const setDraft = (text: string) => {
    latest.current = text
    setNote(null)
    setDraftState(text)
  }

  const save = async () => {
    if (busy.current || entries.length === 0 || problems.length > 0) return
    busy.current = true
    setSaving(true)
    setNote(null)
    const sent = latest.current
    // The other spellings the parent added go with their word (the advice is only for words still in the box).
    const result = await addWords(
      entries.map((entry) => {
        const other = accepted[entry.word.toLowerCase()]
        return other && !entry.alternates.some((a) => same(a, other))
          ? { ...entry, alternates: [...entry.alternates, other] }
          : entry
      }),
    )
    busy.current = false
    setSaving(false)
    if (!result.ok) {
      const text = failure(result)
      if (text) setNote({ tone: 'warn', text })
      return
    }
    setNote({ tone: 'info', text: COPY.wordsAdded(result.body.added, result.body.skipped) })
    const savedWords = new Set(entries.map((entry) => entry.word.toLowerCase()))
    setAccepted((a) => Object.fromEntries(Object.entries(a).filter(([word]) => !savedWords.has(word))))
    // Only the text that was saved goes: words typed meanwhile (after it) stay.
    if (latest.current.startsWith(sent)) {
      const rest = latest.current.slice(sent.length).replace(/^[ \t]*\r?\n/, '')
      latest.current = rest
      setDraftState(rest)
    }
  }

  return {
    draft,
    setDraft,
    count: entries.length,
    problems,
    saving,
    note,
    save,
    advice,
    addAlternate,
    removeAlternate,
  }
}

export type WordsForm = ReturnType<typeof useWordsForm>
