import { useEffect, useState } from 'react'
import { keyStillPaired } from './pairing/api'
import { Pair } from './screens/Pair'
import { ParentPage } from './screens/parent/ParentPage'
import { forgetDeviceKey, getDeviceKey, isInstalled } from './storage/device'
import { Assignment } from './screens/Assignment'
import { Home } from './screens/Home'
import { Result, type Outcome } from './screens/Result'

type Screen =
  | { name: 'home' }
  | { name: 'pair' }
  | { name: 'assignment'; seed: number }
  | { name: 'result'; outcome: Outcome }

/** A fresh seed for each assignment. The Worker will issue seeds once results are saved (#10). */
function newSeed(): number {
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
  const start = () => setScreen({ name: 'assignment', seed: newSeed() })
  const [paired, setPaired] = useState(() => getDeviceKey() !== null)

  // Whenever Home opens with a stored key, a key a parent has since unpaired is forgotten, so the Pair
  // button comes back (SPEC §5.4).
  const checkKey = () => {
    const key = getDeviceKey()
    setPaired(key !== null)
    if (!key) return
    keyStillPaired(key).then((ok) => {
      if (!ok && getDeviceKey() === key) {
        forgetDeviceKey()
        setPaired(false)
      }
    })
  }
  const home = () => {
    checkKey()
    setScreen({ name: 'home' })
  }
  useEffect(checkKey, [])

  switch (screen.name) {
    case 'home':
      return (
        <Home
          onStart={start}
          onPair={!paired && isInstalled() ? () => setScreen({ name: 'pair' }) : undefined}
        />
      )
    case 'pair':
      return <Pair onDone={home} />
    case 'assignment':
      return (
        <Assignment
          key={screen.seed}
          seed={screen.seed}
          onFinish={(correct, problemCount) =>
            setScreen({ name: 'result', outcome: { kind: 'finished', correct, problemCount } })
          }
          // Leaving before answering anything records nothing (SPEC §5.1).
          onLeave={(answered, correct) =>
            answered === 0
              ? home()
              : setScreen({ name: 'result', outcome: { kind: 'leftEarly', answered, correct } })
          }
        />
      )
    case 'result':
      return <Result outcome={screen.outcome} onAnother={start} onHome={home} />
  }
}
