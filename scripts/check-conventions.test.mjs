// Proves the Safeguard rule fires (src/ui/Safeguard.tsx): drops a file with hand-written notices into
// src/screens/parent/, runs check-conventions on it, and removes it again.
import { spawnSync } from 'node:child_process'
import { rmSync, writeFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const probe = 'src/screens/parent/zz-safeguard-probe.tsx'
const SLOW = 30_000

describe('check-conventions: Safeguard', { timeout: SLOW }, () => {
  beforeAll(() => {
    writeFileSync(
      probe,
      [
        'export const a = <p className="safeguard safeguard-info" />',
        'export const b = <p className={`x ${y} safeguard-warn`} />',
        "export const c = <p className={cx('x', 'safeguard')} />",
        'export const d = <p className="my-safeguard x-safeguard-y" />',
        '',
      ].join('\n'),
    )
  })
  afterAll(() => rmSync(probe, { force: true }))

  it('rejects a hand-written .safeguard however the class is built, and not a lookalike', () => {
    const r = spawnSync('node scripts/check-conventions.mjs', { shell: true, encoding: 'utf8' })
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
    expect(r.status, out).not.toBe(0)
    for (const line of [1, 2, 3])
      expect(out).toContain(`zz-safeguard-probe.tsx:${line}  Use <Safeguard> from src/ui/Safeguard`)
    expect(out).not.toContain('zz-safeguard-probe.tsx:4  Use <Safeguard>')
  })
})
