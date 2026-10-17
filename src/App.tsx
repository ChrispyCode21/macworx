import { useState } from 'react'
import { Assignment } from './screens/Assignment'
import { Home } from './screens/Home'
import { Result, type Outcome } from './screens/Result'

type Screen = { name: 'home' } | { name: 'assignment'; seed: number } | { name: 'result'; outcome: Outcome }

/** A fresh seed for each assignment. The Worker will issue seeds once results are saved (#10). */
function newSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]
}

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' })
  const start = () => setScreen({ name: 'assignment', seed: newSeed() })
  const home = () => setScreen({ name: 'home' })

  switch (screen.name) {
    case 'home':
      return <Home onStart={start} />
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
