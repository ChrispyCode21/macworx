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

/** The sibling modules a source text imports: `from './x'` (also across lines, `export … from`, `./x.ts`), `import './x'` and `import('./x')`, not ones named in comments. */
function importedNames(text: string): string[] {
  const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const names = [...code.matchAll(/(?:from|import)\s*\(?\s*'\.\/([\w-]+)(?:\.ts)?'/g)].map((m) => m[1])
  return [...new Set(names)]
}

/** Each module in worker/ (not its tests or worker/test/) and the sibling modules it imports, types included. */
function workerImports(): Map<string, string[]> {
  const graph = new Map<string, string[]>()
  const files = readdirSync('worker').filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
  for (const file of files)
    graph.set(file.replace(/\.ts$/, ''), importedNames(readFileSync(join('worker', file), 'utf8')))
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

  it('reads every form of import, and ignores comments and other folders', () => {
    const text = [
      "import { a } from './one'",
      "import type { B } from './two'",
      'import {',
      '  c,',
      "} from './three.ts'",
      "export * from './four'",
      "import './five'",
      "const six = await import('./six')",
      "import { engine } from '../src/engine'",
      "// moved from './commented'",
      "/* import { x } from './blocked' */",
    ].join('\n')
    expect(importedNames(text)).toEqual(['one', 'two', 'three', 'four', 'five', 'six'])
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
