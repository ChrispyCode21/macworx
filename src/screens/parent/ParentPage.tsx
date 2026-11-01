import { useEffect, useRef, useState } from 'react'
import { COPY } from '../../copy'
import {
  getDays,
  getSummary,
  listDevices,
  listLog,
  listResults,
  localDay,
  makeCode,
  unpair,
} from '../../parent/api'
import type { Device, LogEntry, ParentResult, ResultRow, Summary } from '../../parent/api'
import type { Tab } from '../../parent/route'
import { Button } from '../../ui/Button'
import { minutesLeft } from '../../ui/format'
import { DevicesScreen } from './DevicesScreen'
import { Overview } from './Overview'
import { PointsScreen } from './PointsScreen'
import { Shop } from './Shop'
import { StreakScreen } from './StreakScreen'
import { useAdjust } from './useAdjust'
import { useStreakForm } from './useStreakForm'

const MAX_NAME = 40

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

/**
 * The parent portal's screen contents (SPEC §5.3): her numbers, results, devices, adjustments and activity log,
 * split across the tabs. All state lives here, so switching tabs never refetches or clears a half-typed form;
 * the Portal remounts it when another child is chosen.
 */
export function ParentPage({
  tab,
  childName,
  onGo,
}: {
  tab: Tab
  childName: string | null
  /** Opens another tab (the Overview links), keeping the selected child. */
  onGo: (tab: Tab) => void
}) {
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
  const [days, setDays] = useState<string[] | null>(null)
  // Kept apart from the page banner, which a later successful refresh clears.
  const [daysFailed, setDaysFailed] = useState(false)
  // The days read happens once per page, the first time the Streak tab shows.
  const daysAsked = useRef(false)
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
    setResults(resultsResult.body.results)
    setDevices(devicesResult.body.devices)
    setLog(logResult.body.entries)
    setProblem(null)
  }
  const adjust = useAdjust({
    balance: summary?.balance ?? null,
    live,
    onSaved: refresh,
    fail: failure,
    summaryFail: summaryFailure,
  })
  const streakForm = useStreakForm({ summary, live, onSaved: refresh, fail: failure })
  useEffect(() => {
    live.current = true
    void refresh()
    return () => {
      live.current = false
    }
  }, [])

  // The last 7 days load when the Streak tab first shows, so no other tab makes the call.
  useEffect(() => {
    if (tab !== 'streak' || daysAsked.current) return
    daysAsked.current = true
    void (async () => {
      const result = await getDays()
      if (!live.current) return
      if (!result.ok) {
        // The next visit to the Streak tab reads again.
        daysAsked.current = false
        setDaysFailed(true)
        return setProblem(summaryFailure(result))
      }
      setDaysFailed(false)
      setDays(result.body.days)
    })()
  }, [tab])

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
        <Overview
          summary={summary}
          results={results}
          devices={devices}
          childName={childName}
          today={localDay()}
          onGo={onGo}
          pending={pending}
          unavailable={unavailable}
        />
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
        <StreakScreen
          summary={summary}
          days={days}
          problem={problem !== null || daysFailed}
          today={localDay()}
          form={streakForm}
          pending={pending}
        />
      )}

      {tab === 'points' && (
        <PointsScreen
          summary={summary}
          log={log}
          devices={devices}
          adjust={adjust}
          unavailable={unavailable}
          pending={pending}
        />
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
