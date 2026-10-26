import { useEffect, useState } from 'react'
import { COPY } from '../../copy'
import { getSummary, LIST_LIMIT, listDevices, listLog, listResults, makeCode, unpair } from '../../parent/api'
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

const MAX_NAME = 40

/** What a failed parent call shows. While the page reloads for a sign-in, nothing. */
function failure(result: Extract<ParentResult<unknown>, { ok: false }>): string | null {
  if (result.error === 'reloading') return null
  if (result.error === 'signed_out') return COPY.parentSignedOut
  if (result.error === 'offline') return COPY.parentOffline
  if (result.error === 'bad_name') return COPY.parentNameProblem
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
  return COPY.parentLogOther
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
