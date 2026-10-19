import { describe, expect, it } from 'vitest'
import { addressKey } from './pair'

describe('rate-limit key for an address', () => {
  it('keeps an IPv4 address as is', () => {
    expect(addressKey('203.0.113.7')).toBe('203.0.113.7')
  })

  it('reduces IPv6 to its /64 block, however it is written', () => {
    const key = '2001:db8:1:2::/64'
    expect(addressKey('2001:db8:1:2::5')).toBe(key)
    expect(addressKey('2001:0db8:0001:0002:aaaa:bbbb:cccc:dddd')).toBe(key)
    expect(addressKey('2001:DB8:1:2:0:0:0:9')).toBe(key)
    expect(addressKey('2001:db8::1')).toBe('2001:db8:0:0::/64')
    expect(addressKey('::1')).toBe('0:0:0:0::/64')
  })

  it('tells different /64 blocks apart', () => {
    expect(addressKey('2001:db8:1:2::5')).not.toBe(addressKey('2001:db8:1:3::5'))
  })
})
