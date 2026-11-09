import { useEffect, useRef, useState } from 'react'
import { Pair } from './screens/Pair'
import { Portal } from './screens/parent/Portal'
import { payout } from './engine'
import { canPair, getDeviceKey, getQueue, getWorkerState, requestPersistence } from './storage/device'
import { homeNumbers, nextResult, practiceChild } from './sync/projection'
import type { HomeNumbers, PracticeChild } from './sync/projection'
import { startReading, type ReadingPassage } from './sync/reading'
import { endSeed, localDay, sync, takeSeed } from './sync/sync'
import { ReadingAssignment } from './screens/practice/ReadingAssignment'
import { Assignment } from './screens/Assignment'
import { Home } from './screens/Home'
import { ReadingPractice } from './screens/practice/ReadingPractice'
import { SpellingPractice } from './screens/practice/SpellingPractice'
import { Result, type Outcome } from './screens/Result'

type Screen =
  | { name: 'home' }
  | { name: 'pair' }
  | { name: 'practice'; subject: 'spelling' | 'reading'; child: PracticeChild | undefined }
  | { name: 'reading'; attempt: number; passage: ReadingPassage }
  | { name: 'assignment'; seed: number }
  | { name: 'result'; outcome: Outcome; reading?: true }

/** A seed for an iPad that isn't paired: it practices and saves nothing (SPEC §6.8). */
function practiceSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]
}

/** /parent and its tabs are a full page load (behind Cloudflare Access), never a route inside her app (SPEC §5.3). */
export function App() {
  return location.pathname === '/parent' || location.pathname.startsWith('/parent/') ? (
    <Portal />
  ) : (
    <ChildApp />
  )
}

/** Her four numbers for Home: none without a key or before the Worker's state arrives (SPEC §6.8). */
function currentNumbers(): HomeNumbers | undefined {
  if (!getDeviceKey()) return undefined
  return homeNumbers(getWorkerState(), getQueue(), localDay(new Date())) ?? undefined
}

/** Her name, grade and initials for the practice top bar: none without a key or before the Worker sends them. */
function currentChild(): PracticeChild | undefined {
  if (!getDeviceKey()) return undefined
  return practiceChild(getWorkerState()) ?? undefined
}

function ChildApp() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' })
  const [paired, setPaired] = useState(() => getDeviceKey() !== null)
  const [noSeeds, setNoSeeds] = useState(false)
  const [readingOffline, setReadingOffline] = useState(false)
  const [numbers, setNumbers] = useState(currentNumbers)
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
  // Subjects open their practice screens. On a paired iPad, Reading is a paid assignment: the Worker hands out the
  // passage (SPEC §5.6). Without a connection nothing starts; an unpaired iPad, or no passages, gets the sample.
  const open = async (subject: 'spelling' | 'reading') => {
    const sample = () => setScreen({ name: 'practice', subject, child: currentChild() })
    if (subject !== 'reading' || !getDeviceKey()) return sample()
    if (starting.current) return
    starting.current = true
    setReadingOffline(false)
    const from = shown.current
    const outcome = await startReading()
    starting.current = false
    // She went somewhere else meanwhile: don't pull her into a story.
    if (shown.current !== from) return
    setPaired(getDeviceKey() !== null)
    if (outcome.kind === 'offline') setReadingOffline(true)
    else if (outcome.kind === 'sample') sample()
    else setScreen({ name: 'reading', attempt: outcome.attempt, passage: outcome.passage })
  }
  const end = (seed: number, answers: number[], now: Date) => {
    endSeed(seed, answers, now)
    setNumbers(currentNumbers())
  }

  // Whenever Home opens, results go out and seeds come in. A key a parent has since unpaired is forgotten
  // (a 401), so the Pair button comes back (SPEC §5.4).
  const refresh = () => {
    setPaired(getDeviceKey() !== null)
    setNumbers(currentNumbers())
    if (!getDeviceKey()) return
    requestPersistence()
    sync().then(() => {
      setPaired(getDeviceKey() !== null)
      setNumbers(currentNumbers())
    })
  }
  const home = () => {
    refresh()
    setScreen({ name: 'home' })
  }
  useEffect(() => {
    refresh()
    // Home may be showing when the connection comes back, so its numbers follow the sync.
    const online = () => void sync().then(() => setNumbers(currentNumbers()))
    addEventListener('online', online)
    return () => removeEventListener('online', online)
  }, [])

  switch (screen.name) {
    case 'home':
      return (
        <Home
          onStart={start}
          onOpen={open}
          noSeeds={noSeeds}
          readingOffline={readingOffline}
          numbers={numbers}
          onPair={!paired && canPair() ? () => setScreen({ name: 'pair' }) : undefined}
        />
      )
    case 'practice':
      return screen.subject === 'spelling' ? (
        <SpellingPractice numbers={numbers} child={screen.child} onBack={home} />
      ) : (
        <ReadingPractice numbers={numbers} child={screen.child} onBack={home} />
      )
    case 'reading':
      return (
        <ReadingAssignment
          key={screen.attempt}
          attempt={screen.attempt}
          passage={screen.passage}
          numbers={numbers}
          // Read when the assignment opens; the screen keeps it for the whole assignment.
          child={currentChild()}
          onBack={home}
          onDone={(result) => {
            // The Worker already stored the new numbers; the payout is the Worker's, not worked out here.
            setNumbers(currentNumbers())
            setScreen({
              name: 'result',
              outcome: {
                kind: 'finished',
                correct: result.correct,
                problemCount: result.answered,
                earned: result.payout,
              },
              reading: true,
            })
          }}
        />
      )
    case 'pair':
      return <Pair onDone={home} />
    case 'assignment':
      return (
        <Assignment
          key={screen.seed}
          seed={screen.seed}
          numbers={numbers}
          // Read when the assignment opens; Assignment keeps it for the whole assignment.
          child={currentChild()}
          onFinish={(answers, correct) => {
            // One clock reading, so the streak bonus is priced on the day the result is dated.
            const now = new Date()
            const state = getWorkerState()
            const problemCount = answers.length
            const earned =
              getDeviceKey() && state
                ? nextResult(state, getQueue(), correct, localDay(now))
                : payout({ correct, problemCount, firstOfDay: false, streak: 0 })
            end(screen.seed, answers, now)
            setScreen({ name: 'result', outcome: { kind: 'finished', correct, problemCount, earned } })
          }}
          // Leaving before answering anything records nothing (SPEC §5.1).
          onLeave={(answers, correct) => {
            end(screen.seed, answers, new Date())
            if (answers.length === 0) home()
            else
              setScreen({ name: 'result', outcome: { kind: 'leftEarly', answered: answers.length, correct } })
          }}
        />
      )
    case 'result':
      return <Result outcome={screen.outcome} onAnother={screen.reading ? undefined : start} onHome={home} />
  }
}
