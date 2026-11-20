import { describe, expect, it } from 'vitest'
import { parseEmails } from './csv'

describe('parseEmails', (): void => {
  it('normalizes separators, casing, and display-name brackets', (): void => {
    expect(parseEmails('  A@B.COM, c@d.org\n<e@f.io>; "G@H.net" ')).toEqual([
      'a@b.com',
      'c@d.org',
      'e@f.io',
      'g@h.net'
    ])
  })

  it('deduplicates repeated addresses', (): void => {
    expect(parseEmails('a@b.com a@b.com\nA@B.COM')).toEqual(['a@b.com'])
  })

  it('ignores malformed entries and empty input', (): void => {
    expect(parseEmails('not-an-email, x@y, a@b')).toEqual([])
    expect(parseEmails('')).toEqual([])
  })
})
