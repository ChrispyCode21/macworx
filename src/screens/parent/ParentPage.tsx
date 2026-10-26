import { useEffect, useRef, useState } from 'react'
import { COPY } from '../../copy'
import {
  adjustBalance,
  getSummary,
  LIST_LIMIT,
  listDevices,
  listLog,
  listResults,
  makeCode,
  setStreak,
  unpair,
} from '../../parent/api'
import type { Device, LogEntry, ParentResult, ResultRow, Summary } from '../../parent/api'
import { Button } from '../../ui/Button'
import {
  formatCalendarDay,
  formatCode,
  formatDay,
  formatMoment,
  formatNumber,
  minutesLeft,
} from '../../ui/format'
import { TextField } from '../../ui/TextField'
import { ResultCorrection } from './ResultCorrection'

const MAX_NAME = 40
const MAX_STREAK = 3650
const MAX_NOTE = 200
const MAX_AMOUNT = 100_000

/** What a failed parent call shows. While the page reloads for a sign-in, nothing. */
function failure(result: Extract<ParentResult<unknown>, { ok: false }>): string | null {
  if (result.error === 'reloading') return null
  if (result.error === 'signed_out') return COPY.parentSignedOut
  if (result.error === 'offline') return COPY.parentOffline
  if (result.error === 'bad_name') return COPY.parentNameProblem
  if (result.error === 'bad_streak' || result.error === 'bad_day') return COPY.parentStreakProblem
  if (result.error === 'bad_amount') return COPY.parentAmountProblem
  if (result.error === 'bad_note') return COPY.parentNoteProblem
  if (result.error === 'busy') return COPY.parentBusy
  return COPY.parentServerTrouble
}

/** What an activity log entry says, in plain words. Actions this page doesn't know read as a general change. */
function describe(entry: LogEntry, devices: Device[]): string {
  if (entry.action === 'pairing_code' && typeof entry.detail.name === 'string')
    return COPY.parentLogPairingCode(entry.detail.name)
  if (entry.action === 'unpair') {
    const label = devices.find((d) => d.id === entry.detail.deviceId)?.label
    return COPY.parentLogUnpair(label ?? COPY.parentLogUnknownIpad)
  }
  if (entry.action === 'streak') {
    const after = entry.detail.after as { streak?: unknown; lastDay?: unknown } | null | undefined
    if (typeof after?.streak === 'number' && (typeof after.lastDay === 'string' || after.lastDay === null))
      return COPY.parentLogStreak(after.streak, after.lastDay)
  }
  if (entry.action === 'correction') {
    const { day, before, after, note: why } = entry.detail
    const b = before as { correct?: unknown; total?: unknown } | null | undefined
    const a = after as { correct?: unknown; total?: unknown } | null | undefined
    if (
      typeof day === 'string' &&
      typeof why === 'string' &&
      typeof b?.correct === 'number' &&
      typeof b.total === 'number' &&
      typeof a?.correct === 'number' &&
      typeof a.total === 'number'
    )
      return COPY.parentLogCorrected(formatCalendarDay(day), b.correct, a.correct, a.total - b.total, why)
  }
  const { amount, note } = entry.detail
  if (entry.action === 'balance' && typeof amount === 'number' && typeof note === 'string')
    return amount < 0 ? COPY.parentLogRemoved(-amount, note) : COPY.parentLogAdded(amount, note)
  return COPY.parentLogOther
}

const WHOLE_NUMBER = /^\d{1,4}$/

/** The streak form's two boxes as the Worker wants them, or null when they can't be sent (SPEC §5.3). */
function streakFields(
  streakText: string,
  dayText: string,
): { streak: number; lastDay: string | null } | null {
  const text = streakText.trim()
  if (!WHOLE_NUMBER.test(text) || Number(text) > MAX_STREAK) return null
  const streak = Number(text)
  // The date box only ever holds a real date or nothing; empty goes with a streak of 0 only.
  if (dayText === '') return streak === 0 ? { streak, lastDay: null } : null
  return { streak, lastDay: dayText }
}

/** The parent dashboard at /parent (SPEC §5.3): her numbers, results, iPads and the activity log. */
export function ParentPage() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [results, setResults] = useState<ResultRow[] | null>(null)
  const [log, setLog] = useState<LogEntry[] | null>(null)
  const [devices, setDevices] = useState<Device[] | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [confirming, setConfirming] = useState<Device | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [making, setMaking] = useState(false)
  const [streakText, setStreakText] = useState('')
  const [dayText, setDayText] = useState('')
  const [savingStreak, setSavingStreak] = useState(false)
  const [streakSaved, setStreakSaved] = useState(false)
  // The boxes fill from her numbers once, so a later refresh never overwrites what a parent is typing.
  const prefilled = useRef(false)

  const fillStreakForm = (s: Summary) => {
    prefilled.current = true
    setStreakText(String(s.streak))
    setDayText(s.lastDay ?? '')
  }
  const [removing, setRemoving] = useState(false)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<number | null>(null)
  const [adjustProblem, setAdjustProblem] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState<number | null>(null)
  const [corrected, setCorrected] = useState<number | null>(null)

  // One call at a time, so a run-out Access sign-in reloads the page once, not once per call.
  const refresh = async () => {
    const summaryResult = await getSummary()
    if (!summaryResult.ok) return setProblem(failure(summaryResult))
    const resultsResult = await listResults()
    if (!resultsResult.ok) return setProblem(failure(resultsResult))
    const devicesResult = await listDevices()
    if (!devicesResult.ok) return setProblem(failure(devicesResult))
    const logResult = await listLog()
    if (!logResult.ok) return setProblem(failure(logResult))
    setSummary(summaryResult.body)
    if (!prefilled.current) fillStreakForm(summaryResult.body)
    setResults(resultsResult.body.results)
    setDevices(devicesResult.body.devices)
    setLog(logResult.body.entries)
    setProblem(null)
  }
  useEffect(() => {
    void refresh()
  }, [])

  // The code card counts down; check every 15 seconds.
  useEffect(() => {
    if (!code) return
    const timer = setInterval(() => setNow(new Date()), 15_000)
    return () => clearInterval(timer)
  }, [code])

  const onMakeCode = async () => {
    setProblem(null)
    const trimmed = name.trim()
    if (trimmed.length < 1 || trimmed.length > MAX_NAME) return setProblem(COPY.parentNameProblem)
    // One request at a time: a second code voids the first, so a quick double click must not race.
    setMaking(true)
    const result = await makeCode(trimmed)
    setMaking(false)
    if (!result.ok) return setProblem(failure(result))
    setNow(new Date())
    setCode(result.body)
  }

  const onUnpair = async (device: Device) => {
    setConfirming(null)
    setProblem(null)
    const result = await unpair(device.id)
    if (!result.ok) return setProblem(failure(result))
    await refresh()
  }

  const onSaveStreak = async () => {
    setProblem(null)
    setStreakSaved(false)
    const fields = streakFields(streakText, dayText)
    if (!fields) return setProblem(COPY.parentStreakProblem)
    // One request at a time, so a quick double click saves once.
    setSavingStreak(true)
    const result = await setStreak(fields.streak, fields.lastDay)
    setSavingStreak(false)
    if (!result.ok) return setProblem(failure(result))
    fillStreakForm(result.body)
    setStreakSaved(true)
    await refresh()
  }

  const onSave = async () => {
    setSaved(null)
    setAdjustProblem(null)
    const trimmed = note.trim()
    const count = /^\d+$/.test(amount.trim()) ? Number(amount.trim()) : 0
    if (count < 1 || count > MAX_AMOUNT) return setAdjustProblem(COPY.parentAmountProblem)
    if (trimmed.length < 1 || trimmed.length > MAX_NOTE) return setAdjustProblem(COPY.parentNoteProblem)
    // One request at a time, so a quick double click can't save the same change twice.
    setSaving(true)
    const result = await adjustBalance(removing ? -count : count, trimmed)
    setSaving(false)
    if (result.ok) {
      setAmount('')
      setNote('')
      setSaved(result.body.balance)
      return refresh()
    }
    if (result.error === 'overdraw') {
      const latest = await getSummary()
      return setAdjustProblem(latest.ok ? COPY.parentOverdraw(latest.body.balance) : failure(latest))
    }
    setAdjustProblem(failure(result))
  }

  // Before a list or the numbers arrive: "Loading…", or a dash and a note once a call has failed.
  const pending = <span className="parent-pending">{problem ? COPY.parentNoValue : COPY.parentLoading}</span>
  const unavailable = problem ? <p>{COPY.parentUnavailable}</p> : null

  const left = code ? minutesLeft(code.expiresAt, now) : 0

  return (
    <main className="parent">
      <h1>{COPY.parentTitle}</h1>
      {problem && (
        <p className="parent-problem" role="alert">
          {problem}
        </p>
      )}

      <dl className="parent-summary" aria-label={COPY.parentSummaryLabel}>
        <div>
          <dt>{COPY.parentBalance}</dt>
          <dd>{summary ? formatNumber(summary.balance) : pending}</dd>
        </div>
        <div>
          <dt>{COPY.parentStreak}</dt>
          <dd>{summary ? COPY.parentStreakValue(summary.streak) : pending}</dd>
        </div>
        <div>
          <dt>{COPY.parentLastDay}</dt>
          <dd>
            {summary
              ? summary.lastDay
                ? formatCalendarDay(summary.lastDay)
                : COPY.parentNoLastDay
              : pending}
          </dd>
        </div>
        <div>
          <dt>{COPY.parentCompleted}</dt>
          <dd>{summary ? formatNumber(summary.completed) : pending}</dd>
        </div>
      </dl>

      <div className="parent-columns">
        <section className="parent-section">
          <h2>{COPY.parentResultsHeading}</h2>
          {results === null && unavailable}
          {results?.length === 0 && <p>{COPY.parentNoResults}</p>}
          {results && results.length > 0 && (
            <div className="parent-table-wrap">
              <table className="parent-table">
                <thead>
                  <tr>
                    <th scope="col">{COPY.parentColDate}</th>
                    <th scope="col">{COPY.parentColRight}</th>
                    <th scope="col">{COPY.parentColGrade}</th>
                    <th scope="col">{COPY.parentColEarned}</th>
                    <th scope="col">{COPY.parentColReview}</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.id}>
                      <td>{formatCalendarDay(r.day)}</td>
                      <td>{COPY.parentRightOf(r.correct, r.answered)}</td>
                      <td>{r.finished && r.grade ? r.grade : COPY.parentLeftEarly}</td>
                      <td>{formatNumber(r.total)}</td>
                      <td>
                        <Button
                          variant="secondary"
                          aria-label={COPY.parentReviewLabel(formatCalendarDay(r.day))}
                          onClick={() => {
                            setCorrected(null)
                            setReviewing(r.id)
                          }}
                        >
                          {COPY.parentReview}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {reviewing !== null && (
            <ResultCorrection
              key={reviewing}
              id={reviewing}
              failureText={failure}
              onClose={() => setReviewing(null)}
              onSaved={(balance) => {
                setReviewing(null)
                setCorrected(balance)
                void refresh()
              }}
            />
          )}
          {corrected !== null && <p role="status">{COPY.parentSaved(corrected)}</p>}
          {results?.length === LIST_LIMIT && <p>{COPY.parentLatest(LIST_LIMIT)}</p>}
        </section>

        <div className="parent-side">
          <section className="parent-section">
            <h2>{COPY.parentIpadsHeading}</h2>
            <h3>{COPY.parentPairHeading}</h3>
            <TextField
              label={COPY.parentNameLabel}
              hint={COPY.parentNameHint}
              value={name}
              maxLength={MAX_NAME}
              onChange={(e) => setName(e.target.value)}
            />
            <Button onClick={onMakeCode} disabled={making}>
              {COPY.parentMakeCode}
            </Button>
            {code && (
              <div className="parent-code" aria-live="polite">
                {left > 0 ? (
                  <>
                    <p className="parent-code-digits">{formatCode(code.code)}</p>
                    <p>{COPY.parentCodeWithin(left)}</p>
                  </>
                ) : (
                  <p>{COPY.parentCodeRanOut}</p>
                )}
              </div>
            )}
            <h3>{COPY.parentDevicesHeading}</h3>
            {devices === null && unavailable}
            {devices?.length === 0 && <p>{COPY.parentNoDevices}</p>}
            <ul className="parent-devices">
              {devices?.map((d) => (
                <li key={d.id} className="parent-device">
                  <span className="parent-device-name">{d.label}</span>
                  <span>
                    {d.revokedAt
                      ? COPY.parentUnpairedOn(formatDay(d.revokedAt))
                      : COPY.parentPairedOn(formatDay(d.createdAt))}
                  </span>
                  {!d.revokedAt && (
                    <Button variant="secondary" onClick={() => setConfirming(d)}>
                      {COPY.parentUnpair}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="parent-section">
            <h2>{COPY.parentAdjustHeading}</h2>
            <h3>{COPY.parentStreakFormHeading}</h3>
            <TextField
              label={COPY.parentStreakLabel}
              hint={COPY.parentStreakHint}
              inputMode="numeric"
              value={streakText}
              onChange={(e) => {
                setStreakText(e.target.value)
                setStreakSaved(false)
              }}
            />
            <TextField
              label={COPY.parentLastDayLabel}
              hint={COPY.parentLastDayHint}
              type="date"
              value={dayText}
              onChange={(e) => {
                setDayText(e.target.value)
                setStreakSaved(false)
              }}
            />
            <Button onClick={onSaveStreak} disabled={savingStreak}>
              {COPY.parentStreakSave}
            </Button>
            <p role="status">{streakSaved ? COPY.parentStreakSaved : ''}</p>
            <h3>{COPY.parentMacaroniFormHeading}</h3>
            <p>{COPY.parentAdjustIntro}</p>
            <div className="parent-choice">
              <Button
                variant={removing ? 'secondary' : 'primary'}
                aria-pressed={!removing}
                onClick={() => setRemoving(false)}
              >
                {COPY.parentAdd}
              </Button>
              <Button
                variant={removing ? 'primary' : 'secondary'}
                aria-pressed={removing}
                onClick={() => setRemoving(true)}
              >
                {COPY.parentRemove}
              </Button>
            </div>
            <TextField
              label={COPY.parentAmountLabel}
              inputMode="numeric"
              value={amount}
              maxLength={6}
              onChange={(e) => setAmount(e.target.value)}
            />
            <TextField
              label={COPY.parentNoteLabel}
              hint={COPY.parentNoteHint}
              value={note}
              maxLength={MAX_NOTE}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button onClick={onSave} disabled={saving}>
              {COPY.parentSave}
            </Button>
            {adjustProblem && (
              <p className="parent-problem" role="alert">
                {adjustProblem}
              </p>
            )}
            {saved !== null && <p role="status">{COPY.parentSaved(saved)}</p>}
          </section>

          <section className="parent-section">
            <h2>{COPY.parentLogHeading}</h2>
            {log === null && unavailable}
            {log?.length === 0 && <p>{COPY.parentNoLog}</p>}
            {log && log.length > 0 && (
              <div className="parent-table-wrap">
                <table className="parent-table">
                  <thead>
                    <tr>
                      <th scope="col">{COPY.parentColWhen}</th>
                      <th scope="col">{COPY.parentColWho}</th>
                      <th scope="col">{COPY.parentColWhat}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {log.map((entry) => (
                      <tr key={entry.id}>
                        <td>{formatMoment(entry.at)}</td>
                        <td>{entry.email}</td>
                        <td>{describe(entry, devices ?? [])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {log?.length === LIST_LIMIT && <p>{COPY.parentLatest(LIST_LIMIT)}</p>}
          </section>
        </div>
      </div>

      {confirming && (
        <div
          className="parent-confirm"
          role="alertdialog"
          aria-label={COPY.parentUnpairConfirm(confirming.label)}
        >
          <p>{COPY.parentUnpairConfirm(confirming.label)}</p>
          <Button onClick={() => onUnpair(confirming)}>{COPY.parentUnpair}</Button>
          <Button variant="secondary" onClick={() => setConfirming(null)}>
            {COPY.parentKeepPaired}
          </Button>
        </div>
      )}
    </main>
  )
}
