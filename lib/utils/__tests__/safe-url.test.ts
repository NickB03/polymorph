import { describe, expect, it } from 'vitest'

import { isSafeRedirectTarget } from '../safe-url'

describe('isSafeRedirectTarget', () => {
  it.each([
    'http://example.com/',
    'https://localhost/',
    'https://localhost./',
    'https://foo.localhost./',
    'https://127.0.0.1/',
    'https://10.0.0.5/',
    'https://[::1]/',
    'https://[::]/',
    'https://[::ffff:127.0.0.1]/',
    'https://[::127.0.0.1]/',
    'https://[64:ff9b::a00:5]/',
    'https://[64:ff9b::7f00:1]/',
    'https://[fd00::1]/',
    'https://[fe80::1]/',
    'https://[fe90::1]/',
    'https://[febf::1]/',
    'not a url'
  ])('rejects %s', url => {
    expect(isSafeRedirectTarget(url)).toBe(false)
  })

  it.each([
    'https://example.com/image.png',
    'https://example.com./image.png',
    'https://8.8.8.8/',
    'https://[2606:4700:4700::1111]/',
    'https://[64:ff9b::808:808]/',
    'https://[fec0::1]/'
  ])('allows %s', url => {
    expect(isSafeRedirectTarget(url)).toBe(true)
  })
})
