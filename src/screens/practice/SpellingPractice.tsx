import { useEffect, useState } from 'react'
import { COPY } from '../../copy'
import { checkChoice } from '../../engine'
import { CheckIcon, PlayIcon, Volume2Icon } from '../../practice/icons'
import { SPELLING_COUNT, SPELLING_WORDS } from '../../practice/samples'
import { canSpeak, speak, stopSpeaking } from '../../practice/speech'
import type { HomeNumbers, PracticeChild } from '../../sync/projection'
import { Button } from '../../ui/Button'
import { NextButton } from './NextButton'
import { PracticeFrame } from './PracticeFrame'

interface Props {
  numbers?: HomeNumbers
  child?: PracticeChild | null
  /** Back to Home: the crumb, and the button after the last word. Nothing is kept (SPEC §5.5 step 3). */
  onBack: () => void
}

const LETTERS = ['A', 'B', 'C', 'D']

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

  // What she was hearing never carries over to the next word, or out of the screen.
  useEffect(() => {
    stopSpeaking()
    return stopSpeaking
  }, [index])

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
          <Button key="home" autoFocus variant="action" onClick={onBack}>
            {COPY.backToHome}
          </Button>
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
      {finished ? (
        <section className="practice-panel practice-done">
          <p className="practice-done-title">{COPY.spellingDone(SPELLING_COUNT)}</p>
        </section>
      ) : (
        <section className="practice-panel practice-spelling">
          <div className="practice-listen">
            <p className="practice-eyebrow">{COPY.spellingEyebrow}</p>
            <Button
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
            <div className="practice-choice-list" role="radiogroup" aria-label={COPY.spellingChoiceHeading}>
              {item.choices.map((text, i) => {
                const result = checked && i === chosen ? (right ? 'right' : 'not-right') : undefined
                return (
                  <Button
                    key={text}
                    variant="choice"
                    role="radio"
                    aria-checked={i === chosen}
                    disabled={checked}
                    data-result={result}
                    onClick={() => setChosen(i)}
                  >
                    <span className="choice-marker">{LETTERS[i]}</span>
                    <span className="word-choice">{text}</span>
                    {result === 'right' && <CheckIcon size={22} />}
                  </Button>
                )
              })}
            </div>
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
          {/* Always mounted, so VoiceOver announces each response as its text changes. */}
          <p className="visually-hidden" aria-live="polite">
            {response}
          </p>
        </section>
      )}
    </PracticeFrame>
  )
}
