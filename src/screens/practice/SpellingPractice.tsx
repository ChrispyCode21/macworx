import { useEffect, useId, useRef, useState } from 'react'
import { COPY } from '../../copy'
import { checkSpelling } from '../../engine'
import { CheckIcon, PlayIcon, Volume2Icon } from '../../practice/icons'
import { SPELLING_WORDS } from '../../practice/samples'
import { speakWord, stopSpeaking } from '../../practice/speech'
import type { HomeNumbers, PracticeChild } from '../../sync/projection'
import { finishSpelling } from '../../sync/spelling'
import type { AssignedWord, SpellingResult } from '../../sync/spelling'
import { Button } from '../../ui/Button'
import { PracticePanel } from '../../ui/PracticePanel'
import { WordBox } from '../../ui/WordBox'
import { BackToHomeButton } from './BackToHomeButton'
import { InlineResponse } from './InlineResponse'
import { NextButton } from './NextButton'
import { PracticeDone } from './PracticeDone'
import { PracticeFrame } from './PracticeFrame'

interface Props {
  numbers?: HomeNumbers
  child?: PracticeChild | null
  /** Back to Home: the crumb, and the button after the last word. Nothing is kept (SPEC §5.5 step 3). */
  onBack: () => void
  /**
   * The Worker's words and attempt make this a recorded assignment (SPEC §5.7). The attempt is kept for this screen's
   * whole life: a Finish that has to be retried never asks for words again. Without them this is the sample.
   */
  words?: readonly AssignedWord[]
  attempt?: number
  /** Done, once the Worker has recorded the result (SPEC §5.7 step 4). */
  onDone?: (result: SpellingResult) => void
}

/**
 * Spelling practice: words typed and checked on the iPad. The sample is 8 words and nothing is recorded, sent or paid
 * (SPEC §5.5). With the Worker's words it is an assignment: Finish sends her typing to be marked and paid (§5.7).
 */
export function SpellingPractice({ numbers, child, onBack, words, attempt, onDone }: Props) {
  const list = words ?? SPELLING_WORDS
  const count = list.length
  const recorded = attempt !== undefined && onDone !== undefined
  // Frozen when the screen opens, so a background sync can't change the top bar mid-practice.
  const [shownNumbers] = useState(() => numbers)
  const [shownChild] = useState(() => child)
  const [index, setIndex] = useState(0)
  const [typed, setTyped] = useState('')
  const [checked, setChecked] = useState(false)
  const [finished, setFinished] = useState(false)
  // What she typed for the words before this one, in order.
  const [before, setBefore] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [offline, setOffline] = useState(false)
  const [voided, setVoided] = useState(false)
  // A parent unpaired this iPad while she was typing: nothing can be sent, so Wi-Fi isn't the problem.
  const [disconnected, setDisconnected] = useState(false)
  const [result, setResult] = useState<SpellingResult | null>(null)

  const boxId = useId()
  const playRef = useRef<HTMLButtonElement>(null)
  const shownIndex = useRef(index)
  const sendingRef = useRef(false)

  // What she was hearing never carries over to the next word, into the finished panel, or out of the screen.
  useEffect(() => {
    stopSpeaking()
    return stopSpeaking
  }, [index, finished, result, voided, disconnected])

  // Next unmounts, so focus would fall to the page. Send it to the new word's Play word.
  useEffect(() => {
    if (shownIndex.current === index) return
    shownIndex.current = index
    playRef.current?.focus()
  }, [index])

  const item = list[index]
  const last = index === count - 1
  const right = checked && checkSpelling(typed, item.word, item.alternates)

  const finish = async () => {
    if (sendingRef.current) return
    sendingRef.current = true
    setSending(true)
    try {
      const answers = list.map((w, i) => ({ word: w.id, typed: i < index ? before[i] : typed }))
      const outcome = await finishSpelling(attempt!, answers, new Date())
      setOffline(outcome.kind === 'offline')
      if (outcome.kind === 'checked') setResult(outcome.result)
      else if (outcome.kind === 'voided') setVoided(true)
      else if (outcome.kind === 'unpaired') setDisconnected(true)
    } catch {
      setOffline(true)
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  const next = () => {
    if (last) return recorded ? void finish() : setFinished(true)
    setBefore((b) => [...b, typed])
    setIndex((i) => i + 1)
    setTyped('')
    setChecked(false)
  }

  const response = !checked
    ? null
    : right
      ? COPY.cheers[index % COPY.cheers.length]
      : COPY.spellingAnswer(item.word)
  const over = finished || result !== null || voided || disconnected
  const progress = over
    ? { label: COPY.spellingProgress(count, count), done: count, total: count }
    : { label: COPY.spellingProgress(index + 1, count), done: index + 1, total: count }
  const overMessage = voided
    ? COPY.spellingVoided
    : disconnected
      ? COPY.spellingUnpaired
      : result
        ? COPY.spellingRecorded(result.correct, result.answered)
        : COPY.spellingDone(count)

  return (
    <PracticeFrame
      numbers={shownNumbers}
      child={shownChild}
      subject={COPY.subjectSpelling}
      title={COPY.spellingTitle}
      progress={progress}
      backLabel={COPY.back}
      // Leaving while Finish is on its way would pay her without showing the result.
      onBack={sending ? () => {} : onBack}
      note={over ? undefined : offline ? COPY.spellingFinishOffline : COPY.spellingNote}
      noteIcon={over || offline ? undefined : <Volume2Icon size={20} />}
      actions={
        result ? (
          <NextButton key="done" label={COPY.done} onClick={() => onDone?.(result)} />
        ) : finished || voided || disconnected ? (
          <BackToHomeButton key="home" onClick={onBack} />
        ) : checked ? (
          <NextButton key="next" label={last ? COPY.finish : COPY.next} onClick={next} />
        ) : (
          <Button
            key="check"
            variant="action"
            disabled={typed.trim() === ''}
            onClick={() => setChecked(true)}
          >
            {COPY.check}
            <CheckIcon />
          </Button>
        )
      }
    >
      {/* Always mounted, outside both panels, so VoiceOver announces each response and the finished message as the text changes. */}
      <p className="visually-hidden" aria-live="polite">
        {over ? overMessage : offline ? COPY.spellingFinishOffline : response}
      </p>
      {over ? (
        <PracticeDone>{overMessage}</PracticeDone>
      ) : (
        <PracticePanel className="practice-spelling">
          <div className="practice-listen">
            <p className="practice-eyebrow">{COPY.spellingEyebrow}</p>
            <Button
              ref={playRef}
              variant="play"
              aria-label={COPY.playWord}
              onClick={() => speakWord(item.word, item.sentence)}
            >
              <PlayIcon />
            </Button>
            <div className="practice-listen-text">
              <p className="practice-listen-title">{COPY.playWord}</p>
              <p className="practice-listen-sub">{COPY.playWordSub}</p>
            </div>
          </div>
          <div className="practice-choices">
            <div className="practice-choices-head">
              <label className="practice-choices-heading" htmlFor={boxId}>
                {COPY.spellingBoxHeading}
              </label>
              <p className="practice-choices-hint">{COPY.spellingBoxHint}</p>
            </div>
            <WordBox
              id={boxId}
              value={typed}
              readOnly={checked}
              result={checked ? (right ? 'right' : 'not-right') : undefined}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing && !checked && typed.trim() !== '')
                  setChecked(true)
              }}
            />
            {response ? (
              <InlineResponse right={right}>{response}</InlineResponse>
            ) : (
              <p className="practice-footnote">
                {typed.trim() === '' ? COPY.spellingTypeIt : COPY.readyToCheck}
              </p>
            )}
          </div>
        </PracticePanel>
      )}
    </PracticeFrame>
  )
}
