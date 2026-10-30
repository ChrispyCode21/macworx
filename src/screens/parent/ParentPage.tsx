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
  MAX_NOTE,
  setStreak,
  unpair,
} from '../../parent/api'
import type { Device, LogEntry, ParentResult, ResultRow, Summary } from '../../parent/api'
import { describe } from '../../parent/activity'
import { parseAmount } from '../../parent/adjust'
import type { Tab } from '../../parent/route'
import { Button } from '../../ui/Button'
import { formatCalendarDay, formatMoment, formatNumber, minutesLeft } from '../../ui/format'
import { TextField } from '../../ui/TextField'
import { DevicesScreen } from './DevicesScreen'
import { Shop } from './Shop'

const MAX_NAME = 40
const MAX_STREAK = 3650

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

/** What a failed summary read shows: a bad_day there means the device clock is far off, not a streak problem. */
function summaryFailure(result: Extract<ParentResult<unknown>, { ok: false }>): string | null {
  return result.error === 'bad_day' ? COPY.parentServerTrouble : failure(result)
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

/**
 * The parent portal's screen contents (SPEC §5.3): her numbers, results, devices, adjustments and activity log,
 * split across the tabs. All state lives here, so switching tabs never refetches or clears a half-typed form;
 * the Portal remounts it when another child is chosen.
 */
export function ParentPage({ tab, childName }: { tab: Tab; childName: string | null }) {
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

  // False once the portal has replaced this page (another child was chosen): the reads in flight stop.
  const live = useRef(false)

  // One call at a time, so a run-out Access sign-in reloads the page once, not once per call.
  const refresh = async () => {
    // A replaced page sends no more reads, even when a save it started finishes after the switch.
    if (!live.current) return
    const summaryResult = await getSummary()
    if (!live.current) return
    if (!summaryResult.ok) return setProblem(summaryFailure(summaryResult))
    const resultsResult = await listResults()
    if (!live.current) return
    if (!resultsResult.ok) return setProblem(failure(resultsResult))
    const devicesResult = await listDevices()
    if (!live.current) return
    if (!devicesResult.ok) return setProblem(failure(devicesResult))
    const logResult = await listLog()
    if (!live.current) return
    if (!logResult.ok) return setProblem(failure(logResult))
    setSummary(summaryResult.body)
    if (!prefilled.current) fillStreakForm(summaryResult.body)
    setResults(resultsResult.body.results)
    setDevices(devicesResult.body.devices)
    setLog(logResult.body.entries)
    setProblem(null)
  }
  useEffect(() => {
    live.current = true
    void refresh()
    return () => {
      live.current = false
    }
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
    if (!live.current) return
    setMaking(false)
    if (!result.ok) return setProblem(failure(result))
    setNow(new Date())
    setCode(result.body)
  }

  const onUnpair = async (device: Device) => {
    setConfirming(null)
    setProblem(null)
    const result = await unpair(device.id)
    if (!live.current) return
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
    if (!live.current) return
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
    const count = parseAmount(amount)
    if (count === null) return setAdjustProblem(COPY.parentAmountProblem)
    if (trimmed.length < 1 || trimmed.length > MAX_NOTE) return setAdjustProblem(COPY.parentNoteProblem)
    // One request at a time, so a quick double click can't save the same change twice.
    setSaving(true)
    const result = await adjustBalance(removing ? -count : count, trimmed)
    if (!live.current) return
    setSaving(false)
    if (result.ok) {
      setAmount('')
      setNote('')
      setSaved(result.body.balance)
      return refresh()
    }
    if (result.error === 'overdraw') {
      const latest = await getSummary()
      if (!live.current) return
      return setAdjustProblem(latest.ok ? COPY.parentOverdraw(latest.body.balance) : summaryFailure(latest))
    }
    setAdjustProblem(failure(result))
  }

  // Before a list or the numbers arrive: "Loading…", or a dash and a note once a call has failed.
  const pending = <span className="parent-pending">{problem ? COPY.parentNoValue : COPY.parentLoading}</span>
  const unavailable = problem ? <p>{COPY.parentUnavailable}</p> : null

  const left = code ? minutesLeft(code.expiresAt, now) : 0

  return (
    <>
      {problem && (
        <p className="parent-problem" role="alert">
          {problem}
        </p>
      )}

      {tab === 'shop' && (
        <Shop name={childName} balance={summary?.balance ?? null} problem={problem !== null} />
      )}

      {tab === 'overview' && (
        <>
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
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.id}>
                        <td>{formatCalendarDay(r.day)}</td>
                        <td>{COPY.parentRightOf(r.correct, r.answered)}</td>
                        <td>{r.finished && r.grade ? r.grade : COPY.parentLeftEarly}</td>
                        <td>{formatNumber(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {results?.length === LIST_LIMIT && <p>{COPY.parentLatest(LIST_LIMIT)}</p>}
          </section>
        </>
      )}

      {tab === 'devices' && (
        <DevicesScreen
          devices={devices}
          unavailable={unavailable}
          onUnpair={setConfirming}
          name={name}
          maxName={MAX_NAME}
          onName={setName}
          making={making}
          onMakeCode={onMakeCode}
          code={code}
          left={left}
          childName={childName}
          balance={summary?.balance ?? null}
          streak={summary?.streak ?? null}
        />
      )}

      {tab === 'streak' && (
        <section className="parent-section">
          <h2>{COPY.parentStreakFormHeading}</h2>
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
        </section>
      )}

      {tab === 'points' && (
        <>
          <section className="parent-section">
            <h2>{COPY.parentMacaroniFormHeading}</h2>
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
                        <td>{describe(entry, devices ?? []).title}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {log?.length === LIST_LIMIT && <p>{COPY.parentLatest(LIST_LIMIT)}</p>}
          </section>
        </>
      )}

      {tab === 'devices' && confirming && (
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
    </>
  )
}
