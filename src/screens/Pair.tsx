import { useState } from 'react'
import { CodeBoxes } from '../components/CodeBoxes'
import { NumberPad } from '../components/NumberPad'
import { COPY } from '../copy'
import { pair, type PairResult } from '../pairing/api'
import { setDeviceKey } from '../storage/device'
import { Button } from '../ui/Button'

const CODE_LENGTH = 6

const MESSAGE: Record<Exclude<PairResult['kind'], 'paired'>, string> = {
  notAccepted: COPY.pairNotAccepted,
  tooManyTries: COPY.pairTooManyTries,
  offline: COPY.pairOffline,
  busy: COPY.pairBusy,
}

/** Pair this iPad (SPEC §5.4): the code from a parent, typed on the number pad. */
export function Pair({ onDone }: { onDone: () => void }) {
  const [typed, setTyped] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [paired, setPaired] = useState(false)
  const [sending, setSending] = useState(false)

  const send = async () => {
    setSending(true)
    const result = await pair(typed)
    setSending(false)
    if (result.kind === 'paired' && setDeviceKey(result.key)) {
      setPaired(true)
    } else if (result.kind === 'paired') {
      // Paired on the server but this iPad couldn't keep the key: the code is used, so ask for a new one.
      setMessage(COPY.pairNotAccepted)
      setTyped('')
    } else {
      setMessage(MESSAGE[result.kind])
      setTyped('')
    }
  }

  if (paired)
    return (
      <main className="screen">
        <h1>{COPY.paired}</h1>
        <Button onClick={onDone}>{COPY.pairedDone}</Button>
      </main>
    )

  return (
    <main className="screen pair">
      <h1>{COPY.pairTitle}</h1>
      <p>{COPY.pairInstruction}</p>
      <CodeBoxes typed={typed} length={CODE_LENGTH} />
      <p className="pair-message" aria-live="polite">
        {message}
      </p>
      <NumberPad
        onDigit={(d) => {
          setMessage(null)
          setTyped((t) => (t.length < CODE_LENGTH ? t + String(d) : t))
        }}
        onDelete={() => setTyped((t) => t.slice(0, -1))}
        onCheck={send}
        canCheck={typed.length === CODE_LENGTH && !sending}
        checkLabel={COPY.pairKey}
      />
      {/* Not while a code is on its way: the answer must land on this screen. */}
      <Button variant="secondary" onClick={onDone} disabled={sending}>
        {COPY.back}
      </Button>
    </main>
  )
}
