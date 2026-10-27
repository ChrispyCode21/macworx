import { useEffect, useState } from 'react'
import { COPY } from '../../copy'
import { correctResult, getResultDetail, getSummary, MAX_NOTE } from '../../parent/api'
import type { ParentResult, ResultDetail } from '../../parent/api'
import { Button } from '../../ui/Button'
import { formatCalendarDay, formatNumber, operatorSymbol } from '../../ui/format'
import { TextField } from '../../ui/TextField'

const ANSWER = /^\d{1,6}$/

interface Props {
  id: number
  /** What a failed call says (null while the page reloads for a sign-in). */
  failureText: (result: Extract<ParentResult<unknown>, { ok: false }>) => string | null
  onClose: () => void
  /** The correction was saved; `balance` is her new balance. */
  onSaved: (balance: number) => void
}

/** The correction view (SPEC §5.3): each problem with her answer in a box and the right answer. */
export function ResultCorrection({ id, failureText, onClose, onSaved }: Props) {
  const [detail, setDetail] = useState<ResultDetail | null>(null)
  const [answers, setAnswers] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    void getResultDetail(id).then((result) => {
      if (!result.ok) return setProblem(failureText(result))
      setDetail(result.body.result)
      setAnswers(result.body.result.problems.map((p) => String(p.answer)))
    })
  }, [id, failureText])

  const onSave = async () => {
    if (!detail) return
    setProblem(null)
    if (!answers.every((a) => ANSWER.test(a.trim()))) return setProblem(COPY.parentAnswerProblem)
    const trimmed = note.trim()
    if (trimmed.length < 1 || trimmed.length > MAX_NOTE) return setProblem(COPY.parentNoteProblem)
    const numbers = answers.map((a) => Number(a.trim()))
    if (numbers.every((n, i) => n === detail.problems[i].answer)) return setProblem(COPY.parentNoChange)
    // One request at a time, so a quick double click saves once.
    setSaving(true)
    const result = await correctResult(id, numbers, trimmed)
    setSaving(false)
    if (result.ok) return onSaved(result.body.balance)
    if (result.error === 'overdraw') {
      const latest = await getSummary()
      return setProblem(latest.ok ? COPY.parentCorrectionOverdraw(latest.body.balance) : failureText(latest))
    }
    if (result.error === 'bad_answers') return setProblem(COPY.parentAnswerProblem)
    if (result.error === 'no_change') return setProblem(COPY.parentNoChange)
    if (result.error === 'unknown_result') return setProblem(COPY.parentUnknownResult)
    setProblem(failureText(result))
  }

  return (
    <div className="parent-correction">
      {detail ? (
        <>
          <h3>
            {COPY.parentCorrectionHeading(formatCalendarDay(detail.day), detail.correct, detail.answered)}
          </h3>
          <p>{COPY.parentCorrectionIntro}</p>
          <div className="parent-table-wrap">
            <table className="parent-table">
              <thead>
                <tr>
                  <th scope="col">{COPY.parentColNumber}</th>
                  <th scope="col">{COPY.parentColProblem}</th>
                  <th scope="col">{COPY.parentColHerAnswer}</th>
                  <th scope="col">{COPY.parentColRightAnswer}</th>
                </tr>
              </thead>
              <tbody>
                {detail.problems.map((p, i) => (
                  <tr key={i} className={Number(answers[i]) === p.rightAnswer ? undefined : 'parent-differs'}>
                    <td>{i + 1}</td>
                    <td>{`${formatNumber(p.a)} ${operatorSymbol(p.operation)} ${formatNumber(p.b)}`}</td>
                    <td>
                      <TextField
                        label={COPY.parentAnswerLabel(i + 1)}
                        inputMode="numeric"
                        value={answers[i] ?? ''}
                        maxLength={6}
                        onChange={(e) => setAnswers(answers.map((a, j) => (j === i ? e.target.value : a)))}
                      />
                    </td>
                    <td>{COPY.parentRightAnswer(p.rightAnswer)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TextField
            label={COPY.parentNoteLabel}
            hint={COPY.parentNoteHint}
            value={note}
            maxLength={MAX_NOTE}
            onChange={(e) => setNote(e.target.value)}
          />
          {problem && (
            <p className="parent-problem" role="alert">
              {problem}
            </p>
          )}
          <div className="parent-choice">
            <Button onClick={onSave} disabled={saving}>
              {COPY.parentCorrectionSave}
            </Button>
            <Button variant="secondary" onClick={onClose}>
              {COPY.parentCancel}
            </Button>
          </div>
        </>
      ) : (
        <>
          {problem ? (
            <p className="parent-problem" role="alert">
              {problem}
            </p>
          ) : (
            <p>{COPY.parentCorrectionLoading}</p>
          )}
          <Button variant="secondary" onClick={onClose}>
            {COPY.parentCancel}
          </Button>
        </>
      )}
    </div>
  )
}
