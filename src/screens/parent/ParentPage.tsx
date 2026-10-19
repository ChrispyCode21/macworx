import { useEffect, useState } from 'react'
import { COPY } from '../../copy'
import { listDevices, makeCode, unpair, type Device, type ParentResult } from '../../parent/api'
import { Button } from '../../ui/Button'
import { formatCode, formatDay, minutesLeft } from '../../ui/format'
import { TextField } from '../../ui/TextField'

const MAX_NAME = 40

/** What a failed parent call shows. A run-out sign-in is already reloading the page. */
function failure(result: Extract<ParentResult<unknown>, { ok: false }>): string | null {
  if (result.error === 'signed_out') return null
  if (result.error === 'bad_name') return COPY.parentNameProblem
  return COPY.parentServerTrouble
}

/** The parent dashboard at /parent (SPEC §5.3): pair an iPad, and the paired iPads with Unpair. */
export function ParentPage() {
  const [devices, setDevices] = useState<Device[] | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [confirming, setConfirming] = useState<Device | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  const refresh = async () => {
    const result = await listDevices()
    if (result.ok) setDevices(result.body.devices)
    else setProblem(failure(result))
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
    const result = await makeCode(trimmed)
    if (!result.ok) return setProblem(failure(result))
    setNow(new Date())
    setCode(result.body)
  }

  const onUnpair = async (device: Device) => {
    setConfirming(null)
    const result = await unpair(device.id)
    if (!result.ok) return setProblem(failure(result))
    await refresh()
  }

  const left = code ? minutesLeft(code.expiresAt, now) : 0

  return (
    <main className="parent">
      <h1>{COPY.parentTitle}</h1>
      {problem && (
        <p className="parent-problem" role="alert">
          {problem}
        </p>
      )}

      <section className="parent-section">
        <h2>{COPY.parentPairHeading}</h2>
        <TextField
          label={COPY.parentNameLabel}
          hint={COPY.parentNameHint}
          value={name}
          maxLength={MAX_NAME}
          onChange={(e) => setName(e.target.value)}
        />
        <Button onClick={onMakeCode}>{COPY.parentMakeCode}</Button>
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
      </section>

      <section className="parent-section">
        <h2>{COPY.parentDevicesHeading}</h2>
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
