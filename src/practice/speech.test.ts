import { afterEach, describe, expect, it, vi } from 'vitest'
import { canSpeak, speak, stopSpeaking } from './speech'

class FakeUtterance {
  lang = ''
  rate = 1
  constructor(public text: string) {}
}

function fakeSpeech() {
  const calls: string[] = []
  const spoken: FakeUtterance[] = []
  const synth = {
    cancel: () => calls.push('cancel'),
    speak: (u: FakeUtterance) => {
      calls.push('speak')
      spoken.push(u)
    },
  }
  vi.stubGlobal('window', { speechSynthesis: synth })
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
  return { calls, spoken }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('speech', () => {
  it('can not speak without speechSynthesis', () => {
    vi.stubGlobal('window', {})
    expect(canSpeak()).toBe(false)
  })

  it('can not speak outside a browser', () => {
    expect(canSpeak()).toBe(false)
  })

  it('speaks one utterance in English at 0.8, stopping what was playing first', () => {
    const { calls, spoken } = fakeSpeech()
    expect(canSpeak()).toBe(true)
    speak('friend')
    expect(calls).toEqual(['cancel', 'speak'])
    expect(spoken).toHaveLength(1)
    expect(spoken[0]).toMatchObject({ text: 'friend', lang: 'en-US', rate: 0.8 })
  })

  it('does nothing without speech', () => {
    vi.stubGlobal('window', {})
    expect(() => speak('friend')).not.toThrow()
    expect(() => stopSpeaking()).not.toThrow()
  })

  it('stops speaking', () => {
    const { calls } = fakeSpeech()
    stopSpeaking()
    expect(calls).toEqual(['cancel'])
  })
})
