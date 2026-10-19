import { describe, expect, it } from 'vitest'
import { NETWORK_ONLY_PATHS } from './networkOnly'

const networkOnly = (pathAndQuery: string) => NETWORK_ONLY_PATHS.some((p) => p.test(pathAndQuery))

describe('paths the service worker leaves to the network', () => {
  it.each([
    '/api',
    '/api/state',
    '/api?x=1',
    '/parent',
    '/parent/',
    '/parent/devices',
    '/parent?tab=devices',
    '/cdn-cgi/access/authorized?token=abc',
    '/cdn-cgi/access/logout',
  ])('%s goes to the network', (path) => {
    expect(networkOnly(path)).toBe(true)
  })

  it.each(['/', '/?x=1', '/parents', '/apiary', '/assets/index.js'])('%s may come from the cache', (path) => {
    expect(networkOnly(path)).toBe(false)
  })
})
