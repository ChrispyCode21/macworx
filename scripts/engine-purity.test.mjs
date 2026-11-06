// Proves the engine purity checks fire (CLAUDE.md, "Architecture rules"): drops impure files into
// src/engine/, runs oxlint and check-conventions on them, and removes them again.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const dir = 'src/engine'
const probe = `${dir}/zz-purity-probe.ts`
const jsxProbe = `${dir}/zz-purity-probe.tsx`
const createdDir = !existsSync(dir)

const run = (cmd) => {
  const r = spawnSync(cmd, { shell: true, encoding: 'utf8' })
  // A command that could not start, or was ended early, has no status or output: say why instead (#29).
  const why = [r.error && `Could not run it: ${r.error.message}`, r.signal && `Ended by ${r.signal}.`]
  return { status: r.status, out: [`${r.stdout ?? ''}${r.stderr ?? ''}`, ...why].filter(Boolean).join('\n') }
}

// Each test starts oxlint or check-conventions in a child process, which can take well over Vitest's default
// 5 seconds when the whole suite runs in parallel (#114).
const SLOW = 30_000

describe('engine purity checks', { timeout: SLOW }, () => {
  beforeAll(() => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      probe,
      [
        "import { useState } from 'react'",
        "import { jsx } from 'react/jsx-runtime'",
        "import { readFileSync } from 'fs'",
        "import { App } from '../App'",
        'export const impure = [useState, jsx, readFileSync, App, fetch, globalThis, new Date()]',
        "export const random = [Math.random(), Math['random'](), crypto, performance]",
        '',
      ].join('\n'),
    )
    writeFileSync(jsxProbe, 'export const view = 1\n')
  })
  afterAll(() => {
    if (createdDir) rmSync(dir, { recursive: true, force: true })
    else for (const f of [probe, jsxProbe]) rmSync(f, { force: true })
  })

  it('oxlint rejects every import from outside src/engine', () => {
    const { status, out } = run(`npx oxlint ${probe}`)
    // The output is the failure message: when oxlint once exited 0 here (#29), nothing showed why.
    expect(status, `oxlint exited ${status} on ${probe}:\n${out}`).not.toBe(0)
    for (const line of [1, 2, 3, 4])
      expect(out).toMatch(new RegExp(`probe\\.ts:${line}:1: .*import is restricted`))
  })

  it('oxlint rejects fetch, globalThis, Date, crypto and performance', () => {
    const { out } = run(`npx oxlint ${probe}`)
    for (const name of ['fetch', 'globalThis', 'Date', 'crypto', 'performance'])
      expect(out).toContain(`Unexpected use of '${name}'`)
  })

  it('check-conventions rejects Math.random and .tsx files', () => {
    const { status, out } = run('node scripts/check-conventions.mjs')
    expect(status, `check-conventions exited ${status}:\n${out}`).not.toBe(0)
    expect(out).toContain('zz-purity-probe.ts:6  The engine takes randomness from the seed')
    expect(out).toContain('zz-purity-probe.tsx  The engine is pure TypeScript: no .tsx files')
  })
})
