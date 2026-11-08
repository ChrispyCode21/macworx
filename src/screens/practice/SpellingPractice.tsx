import { useEffect, useRef, useState } from 'react'
import { COPY } from '../../copy'
import { checkChoice } from '../../engine'
import { CheckIcon, PlayIcon, Volume2Icon } from '../../practice/icons'
import { SPELLING_COUNT, SPELLING_WORDS } from '../../practice/samples'
import { canSpeak, speak, stopSpeaking } from '../../practice/speech'
import type { HomeNumbers, PracticeChild } from '../../sync/projection'
import { Button } from '../../ui/Button'
import { PracticePanel } from '../../ui/PracticePanel'
import { BackToHomeButton } from './BackToHomeButton'
import { ChoiceGroup, type ChoiceGroupHandle } from './ChoiceGroup'
import { NextButton } from './NextButton'
import { PracticeFrame } from './PracticeFrame'

interface Props {
  numbers?: HomeNumbers
  child?: PracticeChild | null
  /** Back to Home: the crumb, and the button after the last word. Nothing is kept (SPEC §5.5 step 3). */
  onBack: () => void
}

/** Spelling sample practice: 8 words, checked on the iPad. Nothing is recorded, sent or paid (SPEC §5.5). */
export function SpellingPractice({ numbers, child, onBack }: Props) {
  // Frozen when the screen opens, so a background sync can't change the top bar mid-practice.
  const [shownNumbers] = useState(() => numbers)
  const [shownChild] = useState(() => child)
  const [speech] = useState(canSpeak)
  const [index, setIndex] = useState(0)
  const [chosen, setChosen] = useState<number | null>(null)
  const [checked, setChecked] = useState(false)
  const [finished, setFinished] = useState(false)

  const playRef = useRef<HTMLButtonElement>(null)
  const choicesRef = useRef<ChoiceGroupHandle>(null)
  const shownIndex = useRef(index)

  // What she was hearing never carries over to the next word, into the finished panel, or out of the screen.
  useEffect(() => {
    stopSpeaking()
    return stopSpeaking
  }, [index, finished])

  // Next unmounts, so focus would fall to the page. Send it to the new word: Play word, or the first choice without speech.
  useEffect(() => {
    if (shownIndex.current === index) return
    shownIndex.current = index
    if (speech) playRef.current?.focus()
    else choicesRef.current?.focus(0)
  }, [index, speech])

  const item = SPELLING_WORDS[index]
  const last = index === SPELLING_COUNT - 1
  const right = checked && chosen !== null && checkChoice(chosen, item.answer)

  const next = () => {
    if (last) return setFinished(true)
    setIndex((i) => i + 1)
    setChosen(null)
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
          <Button key="check" variant="action" disabled={chosen === null} onClick={() => setChecked(true)}>
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
        <PracticePanel className="practice-done">
          <p className="practice-done-title">{COPY.spellingDone(SPELLING_COUNT)}</p>
        </PracticePanel>
      ) : (
        <PracticePanel className="practice-spelling">
          <div className="practice-listen">
            <p className="practice-eyebrow">{COPY.spellingEyebrow}</p>
            <Button
              ref={playRef}
              variant="play"
              aria-label={COPY.playWord}
              disabled={!speech}
              onClick={() => speak(item.word)}
            >
              <PlayIcon />
            </Button>
            <div className="practice-listen-text">
              <p className="practice-listen-title">{COPY.playWord}</p>
              <p className="practice-listen-sub">{speech ? COPY.playWordSub : COPY.playUnavailable}</p>
            </div>
            <Button variant="support" disabled={!speech} onClick={() => speak(item.sentence)}>
              <Volume2Icon />
              {COPY.hearSentence}
            </Button>
          </div>
          <div className="practice-choices">
            <div className="practice-choices-head">
              <p className="practice-choices-heading">{COPY.spellingChoiceHeading}</p>
              <p className="practice-choices-hint">{COPY.chooseHint}</p>
            </div>
            <ChoiceGroup
              handle={choicesRef}
              className="practice-choice-list"
              textClass="word-choice"
              label={COPY.spellingChoiceHeading}
              choices={item.choices}
              chosen={chosen}
              onChoose={setChosen}
              checked={checked}
              right={right}
            />
            {response ? (
              <div className="response practice-spelling-response">
                <p className={right ? 'response-lead' : 'response-equation'}>{response}</p>
              </div>
            ) : (
              <p className="practice-footnote">
                {chosen === null ? COPY.spellingChooseOne : COPY.readyToCheck}
              </p>
            )}
          </div>
        </PracticePanel>
      )}
    </PracticeFrame>
  )
}
