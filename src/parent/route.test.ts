import { describe, expect, it } from 'vitest'
import { TABS, tabFromPath, tabPath } from './route'

describe('the portal route', () => {
  it('opens each tab at its own address', () => {
    for (const tab of TABS) {
      expect(tabFromPath(tabPath(tab))).toBe(tab)
      expect(tabFromPath(`${tabPath(tab)}/`)).toBe(tab)
    }
    expect(tabPath('points')).toBe('/parent/points')
    expect(TABS).toEqual(['overview', 'content', 'points', 'streak', 'devices', 'shop'])
    expect(tabPath('content')).toBe('/parent/content')
  })

  it('shows Overview for /parent and any unknown address', () => {
    for (const path of ['/parent', '/parent/', '/parent/nope', '/parent/points/extra', '/parent/Points'])
      expect(tabFromPath(path)).toBe('overview')
  })
})
