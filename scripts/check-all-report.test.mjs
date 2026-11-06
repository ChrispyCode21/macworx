import { describe, expect, it } from 'vitest'
import { failureReport } from './check-all-report.mjs'

describe('failureReport', () => {
  it('shows the output of a step that ran and failed', () => {
    expect(failureReport('lint', { status: 1, stdout: 'bad thing\n', error: undefined, signal: null })).toBe(
      'FAIL lint\nbad thing\n',
    )
  })

  it('shows the real error when a step could not be spawned, with no stdout', () => {
    const error = Object.assign(new Error('spawn /bin/sh ENOENT'), { code: 'ENOENT' })
    expect(failureReport('test', { status: null, stdout: null, error, signal: null })).toBe(
      'FAIL test\nCould not run it: spawn /bin/sh ENOENT\n',
    )
  })

  it('keeps the partial output and the error when the output ran past its buffer', () => {
    const error = Object.assign(new Error('spawnSync /bin/sh ENOBUFS'), { code: 'ENOBUFS' })
    expect(failureReport('build', { status: null, stdout: 'lots of text\n', error, signal: null })).toBe(
      'FAIL build\nlots of text\nCould not run it: spawnSync /bin/sh ENOBUFS\n',
    )
  })

  it('names the signal that ended a step', () => {
    expect(failureReport('test:e2e', { status: null, stdout: '', error: undefined, signal: 'SIGTERM' })).toBe(
      'FAIL test:e2e\nIt was ended by SIGTERM.\n',
    )
  })

  it('says so when a step has no exit status and no other reason', () => {
    expect(failureReport('x', { status: null, stdout: null, error: undefined, signal: null })).toBe(
      'FAIL x\nIt did not finish.\n',
    )
  })

  it('does not throw on a missing stdout', () => {
    expect(() => failureReport('x', { status: 1, stdout: undefined })).not.toThrow()
  })
})
