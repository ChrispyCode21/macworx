import { useEffect, useId, useRef, useState } from 'react'
import { COPY } from '../../copy'
import { checkSpelling } from '../../engine'
import { CheckIcon, PlayIcon, Volume2Icon } from '../../practice/icons'
import { SPELLING_COUNT, SPELLING_WORDS } from '../../practice/samples'
import { speakWord, stopSpeaking } from '../../practice/speech'
import type { HomeNumbers, PracticeChild } from '../../sync/projection'
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
}

/** Spelling sample practice: 8 words, typed and checked on the iPad. Nothing is recorded, sent or paid (SPEC §5.5). */
export function SpellingPractice({ numbers, child, onBack }: Props) {
  // Frozen when the screen opens, so a background sync can't change the top bar mid-practice.
  const [shownNumbers] = useState(() => numbers)
  const [shownChild] = useState(() => child)
  const [index, setIndex] = useState(0)
  const [typed, setTyped] = useState('')
  const [checked, setChecked] = useState(false)
  const [finished, setFinished] = useState(false)

  const boxId = useId()
  const playRef = useRef<HTMLButtonElement>(null)
  const shownIndex = useRef(index)

  // What she was hearing never carries over to the next word, into the finished panel, or out of the screen.
  useEffect(() => {
    stopSpeaking()
    return stopSpeaking
  }, [index, finished])

  // Next unmounts, so focus would fall to the page. Send it to the new word's Play word.
  useEffect(() => {
    if (shownIndex.current === index) return
    shownIndex.current = index
    playRef.current?.focus()
  }, [index])

  const item = SPELLING_WORDS[index]
  const last = index === SPELLING_COUNT - 1
  const right = checked && checkSpelling(typed, item.word, item.alternates)

  const next = () => {
    if (last) return setFinished(true)
    setIndex((i) => i + 1)
    setTyped('')
    setChecked(false)
  }

  const response = !checked
    ? null
    : right
      ? COPY.cheers[index % COPY.cheers.length]
      : COPY.spellingAnswer(item.word)
  const progress = finished
    ? {
        label: COPY.spellingProgress(SPELLING_COUNT, SPELLING_COUNT),
        done: SPELLING_COUNT,
        total: SPELLING_COUNT,
      }
    : { label: COPY.spellingProgress(index + 1, SPELLING_COUNT), done: index + 1, total: SPELLING_COUNT }

  return (
    <PracticeFrame
      numbers={shownNumbers}
      child={shownChild}
      subject={COPY.subjectSpelling}
      title={COPY.spellingTitle}
      progress={progress}
      backLabel={COPY.back}
      onBack={onBack}
      note={finished ? undefined : COPY.spellingNote}
      noteIcon={finished ? undefined : <Volume2Icon size={20} />}
      actions={
        finished ? (
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
        {finished ? COPY.spellingDone(SPELLING_COUNT) : response}
      </p>
      {finished ? (
        <PracticeDone>{COPY.spellingDone(SPELLING_COUNT)}</PracticeDone>
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
