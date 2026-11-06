import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// The Worker's modules don't import each other in a circle (#30). A cycle works only while each side calls the
// other at request time, and breaks the first time one uses the other while the module loads.

/** The first import cycle in a graph of module name to the names it imports, as "a -> b -> a", or null. */
function findCycle(graph: Map<string, string[]>): string | null {
  const done = new Set<string>()
  const walk = (name: string, path: string[]): string | null => {
    if (path.includes(name)) return [...path.slice(path.indexOf(name)), name].join(' -> ')
    if (done.has(name)) return null
    for (const next of graph.get(name) ?? []) {
      const found = walk(next, [...path, name])
      if (found) return found
    }
    done.add(name)
    return null
  }
  for (const name of graph.keys()) {
    const found = walk(name, [])
    if (found) return found
  }
  return null
}

/** Each module in worker/ (not its tests or worker/test/) and the sibling modules it imports, types included. */
function workerImports(): Map<string, string[]> {
  const graph = new Map<string, string[]>()
  const files = readdirSync('worker').filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
  for (const file of files) {
    const text = readFileSync(join('worker', file), 'utf8')
    // `from './x'` (also across lines, and `export … from`) and `import './x'`.
    const names = [...text.matchAll(/(?:from|import)\s+'\.\/([\w-]+)'/g)].map((m) => m[1])
    graph.set(file.replace(/\.ts$/, ''), [...new Set(names)])
  }
  return graph
}

describe('the Worker modules', () => {
  it('finds a cycle in a graph that has one, and none in one that has not', () => {
    const cyclic = new Map([
      ['a', ['b']],
      ['b', ['c']],
      ['c', ['a']],
    ])
    expect(findCycle(cyclic)).toBe('a -> b -> c -> a')
    expect(
      findCycle(
        new Map([
          ['a', ['b', 'c']],
          ['b', ['c']],
          ['c', []],
        ]),
      ),
    ).toBeNull()
  })

  it('reads the imports in worker/', () => {
    const graph = workerImports()
    expect(graph.get('parent')).toEqual(
      expect.arrayContaining(['admin-log', 'children', 'pair', 'parent-request']),
    )
    expect(graph.get('pair')).toEqual(expect.arrayContaining(['admin-log', 'parent-request']))
  })

  it('do not import each other in a circle', () => {
    expect(findCycle(workerImports())).toBeNull()
  })
})
