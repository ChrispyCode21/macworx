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
  return { status: r.status, out: r.stdout + r.stderr }
}

describe('engine purity checks', () => {
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
    expect(status).not.toBe(0)
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
    expect(status).not.toBe(0)
    expect(out).toContain('zz-purity-probe.ts:6  The engine takes randomness from the seed')
    expect(out).toContain('zz-purity-probe.tsx  The engine is pure TypeScript: no .tsx files')
  })
})
