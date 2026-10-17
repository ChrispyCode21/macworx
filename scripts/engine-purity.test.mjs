// Proves the engine purity checks fire (CLAUDE.md, "Architecture rules"): drops an impure file into
// src/engine/, runs oxlint and check-conventions on it, and removes it again.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const dir = 'src/engine'
const probe = `${dir}/zz-purity-probe.ts`
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
        "import { App } from '../App'",
        'export const impure = [useState, App, fetch, new Date(), Math.random()]',
        '',
      ].join('\n'),
    )
  })
  afterAll(() => rmSync(createdDir ? dir : probe, { recursive: true, force: true }))

  it('oxlint rejects React, imports from outside src/engine, fetch and Date', () => {
    const { status, out } = run(`npx oxlint ${probe}`)
    expect(status).not.toBe(0)
    expect(out).toContain("'react' import is restricted")
    expect(out).toContain("'../App' import is restricted")
    expect(out).toContain("Unexpected use of 'fetch'")
    expect(out).toContain("Unexpected use of 'Date'")
  })

  it('check-conventions rejects Math.random', () => {
    const { status, out } = run('node scripts/check-conventions.mjs')
    expect(status).not.toBe(0)
    expect(out).toContain('not Math.random')
  })
})
