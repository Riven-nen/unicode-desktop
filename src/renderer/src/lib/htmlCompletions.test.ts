import { describe, expect, it } from 'vitest'
import { HTML_SNIPPETS, closingTagForHtml, completionRange } from './htmlCompletions'

describe('HTML completion helpers', () => {
  it('covers a bare !DOCTYPE abbreviation', () => {
    expect(completionRange('!DOCTYPE', 9)).toEqual({ startColumn: 1, typed: '!DOCTYPE' })
  })

  it('includes a leading angle bracket so snippets replace it', () => {
    expect(completionRange('<!DOCTYPE', 10)).toMatchObject({ startColumn: 1 })
    expect(completionRange('  <link:css', 12)).toMatchObject({ startColumn: 3 })
  })

  it('starts after leading indentation for a bare tag', () => {
    expect(completionRange('    div', 8)).toEqual({ startColumn: 5, typed: 'div' })
  })

  it('ships the document skeleton and common HTML snippets', () => {
    const doctype = HTML_SNIPPETS.find((snippet) => snippet.label === '!DOCTYPE')
    expect(doctype?.insertText).toContain('<!DOCTYPE html>')
    expect(doctype?.insertText).toContain('<body>')
    expect(HTML_SNIPPETS.map((snippet) => snippet.label)).toEqual(
      expect.arrayContaining(['!doctype', 'html:5', 'link:css', 'script:src', 'img', 'form'])
    )
  })
})

describe('HTML tag auto-closing', () => {
  it('closes a normal opening tag', () => {
    expect(closingTagForHtml('<div>', 6)).toBe('</div>')
    expect(closingTagForHtml('<section class="card">', 23)).toBe('</section>')
  })

  it('leaves void and self-closing tags alone', () => {
    expect(closingTagForHtml('<br>', 5)).toBeNull()
    expect(closingTagForHtml('<img src="a.png" alt="A">', 28)).toBeNull()
    expect(closingTagForHtml('<input type="text">', 20)).toBeNull()
    expect(closingTagForHtml('<div />', 8)).toBeNull()
  })

  it('does not duplicate an existing closing tag', () => {
    expect(closingTagForHtml('<div></div>', 6)).toBeNull()
    expect(closingTagForHtml('</div>', 7)).toBeNull()
    expect(closingTagForHtml('<!DOCTYPE html>', 16)).toBeNull()
  })

  it('ignores a greater-than that is not the end of a tag', () => {
    expect(closingTagForHtml('if (a > b)', 10)).toBeNull()
    expect(closingTagForHtml('text', 5)).toBeNull()
  })
})
