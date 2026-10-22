import { useEffect, useRef, useState } from 'react'
import { Pair } from './screens/Pair'
import { ParentPage } from './screens/parent/ParentPage'
import { canPair, getDeviceKey, requestPersistence } from './storage/device'
import { endSeed, sync, takeSeed } from './sync/sync'
import { Assignment } from './screens/Assignment'
import { Home } from './screens/Home'
import { Result, type Outcome } from './screens/Result'

type Screen =
  | { name: 'home' }
  | { name: 'pair' }
  | { name: 'assignment'; seed: number }
  | { name: 'result'; outcome: Outcome }

/** A seed for an iPad that isn't paired: it practices and saves nothing (SPEC §6.8). */
function practiceSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]
}

/** /parent is a full page load (behind Cloudflare Access), never a route inside her app (SPEC §5.3). */
export function App() {
  return location.pathname === '/parent' || location.pathname.startsWith('/parent/') ? (
    <ParentPage />
  ) : (
    <ChildApp />
  )
}

function ChildApp() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' })
  const [paired, setPaired] = useState(() => getDeviceKey() !== null)
  const [noSeeds, setNoSeeds] = useState(false)
  const starting = useRef(false)
  const shown = useRef(screen)
  shown.current = screen

  // A paired iPad uses its stored seeds, topping up first when it has none (SPEC §6.8).
  const start = async () => {
    if (starting.current) return
    starting.current = true
    setNoSeeds(false)
    const from = shown.current
    let seed = takeSeed()
    if (seed === null && getDeviceKey()) {
      await sync()
      // She went somewhere else meanwhile: don't pull her into an assignment.
      if (shown.current !== from) return void (starting.current = false)
      seed = takeSeed()
    }
    if (seed === null && !getDeviceKey()) seed = practiceSeed()
    starting.current = false
    if (seed === null) {
      setNoSeeds(true)
      setScreen({ name: 'home' })
    } else setScreen({ name: 'assignment', seed })
  }
  const end = (seed: number, answers: number[]) => endSeed(seed, answers, new Date())

  // Whenever Home opens, results go out and seeds come in. A key a parent has since unpaired is forgotten
  // (a 401), so the Pair button comes back (SPEC §5.4).
  const refresh = () => {
    setPaired(getDeviceKey() !== null)
    if (!getDeviceKey()) return
    requestPersistence()
    sync().then(() => setPaired(getDeviceKey() !== null))
  }
  const home = () => {
    refresh()
    setScreen({ name: 'home' })
  }
  useEffect(() => {
    refresh()
    const online = () => void sync()
    addEventListener('online', online)
    return () => removeEventListener('online', online)
  }, [])

  switch (screen.name) {
    case 'home':
      return (
        <Home
          onStart={start}
          noSeeds={noSeeds}
          onPair={!paired && canPair() ? () => setScreen({ name: 'pair' }) : undefined}
        />
      )
    case 'pair':
      return <Pair onDone={home} />
    case 'assignment':
      return (
        <Assignment
          key={screen.seed}
          seed={screen.seed}
          onFinish={(answers, correct) => {
            end(screen.seed, answers)
            setScreen({
              name: 'result',
              outcome: { kind: 'finished', correct, problemCount: answers.length },
            })
          }}
          // Leaving before answering anything records nothing (SPEC §5.1).
          onLeave={(answers, correct) => {
            end(screen.seed, answers)
            if (answers.length === 0) home()
            else
              setScreen({ name: 'result', outcome: { kind: 'leftEarly', answered: answers.length, correct } })
          }}
        />
      )
    case 'result':
      return <Result outcome={screen.outcome} onAnother={start} onHome={home} />
  }
}
