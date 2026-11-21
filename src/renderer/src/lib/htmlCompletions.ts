import type * as monaco from 'monaco-editor'

/** HTML elements that never get a closing tag. */
const VOID_HTML_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
])

/**
 * The closing tag to append after a freshly typed `>`, or null when the tag is
 * void, self-closing, already closed, or not an opening tag.
 */
export function closingTagForHtml(line: string, column: number): string | null {
  const before = line.slice(0, Math.max(0, column - 1))
  const open = before.lastIndexOf('<')
  if (open < 0) return null

  const tagText = before.slice(open)
  const match = tagText.match(/^<([A-Za-z][\w:.-]*)(?:\s[^<>]*)?>$/)
  if (!match || /\/\s*>$/.test(tagText)) return null

  const tag = match[1].toLowerCase()
  if (VOID_HTML_TAGS.has(tag)) return null

  const after = line.slice(Math.max(0, column - 1))
  if (/^\s*<\//.test(after) || /^\s*\/>/.test(after)) return null
  return `</${tag}>`
}

/** A curated Emmet-style snippet set for the HTML language. */
interface HtmlSnippet {
  label: string
  detail: string
  documentation?: string
  insertText: string
  sortText: string
}

const DOCUMENT_SKELETON = [
  '<!DOCTYPE html>',
  '<html lang="en">',
  '  <head>',
  '    <meta charset="UTF-8" />',
  '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
  '    <title>${1:Document}</title>',
  '  </head>',
  '  <body>',
  '    $0',
  '  </body>',
  '</html>'
].join('\n')

export const HTML_SNIPPETS: HtmlSnippet[] = [
  {
    label: '!DOCTYPE',
    detail: 'HTML5 document skeleton',
    documentation: 'Insert <!DOCTYPE html> with head, viewport, title, and body.',
    insertText: DOCUMENT_SKELETON,
    sortText: '00'
  },
  {
    label: '!doctype',
    detail: 'HTML5 document skeleton',
    insertText: DOCUMENT_SKELETON,
    sortText: '00'
  },
  {
    label: 'html:5',
    detail: 'HTML5 document skeleton',
    insertText: DOCUMENT_SKELETON,
    sortText: '01'
  },
  {
    label: 'link:css',
    detail: 'Stylesheet link',
    insertText: '<link rel="stylesheet" href="${1:styles.css}" />',
    sortText: '10'
  },
  {
    label: 'script:src',
    detail: 'External script',
    insertText: '<script src="${1:script.js}"></script>',
    sortText: '11'
  },
  {
    label: 'img',
    detail: 'Image with alt text',
    insertText: '<img src="${1:image.png}" alt="${2:Description}" />',
    sortText: '12'
  },
  {
    label: 'a',
    detail: 'Link',
    insertText: '<a href="${1:https://example.com}">${2:Link text}</a>',
    sortText: '13'
  },
  {
    label: 'ul>li',
    detail: 'Unordered list with one item',
    insertText: '<ul>\n  <li>${1:Item}</li>\n</ul>',
    sortText: '14'
  },
  {
    label: 'form',
    detail: 'Form with a labeled input and button',
    insertText: [
      '<form>',
      '  <label for="${1:name}">${2:Name}</label>',
      '  <input id="${1:name}" name="${1:name}" type="text" />',
      '  <button type="submit">${3:Submit}</button>',
      '</form>'
    ].join('\n'),
    sortText: '15'
  },
  {
    label: 'label+input',
    detail: 'Label and text input',
    insertText: [
      '<label for="${1:field}">${2:Label}</label>',
      '<input id="${1:field}" name="${1:field}" type="text" />'
    ].join('\n'),
    sortText: '16'
  },
  {
    label: 'table',
    detail: 'Table with a header and one row',
    insertText: [
      '<table>',
      '  <thead>',
      '    <tr><th>${1:Column}</th></tr>',
      '  </thead>',
      '  <tbody>',
      '    <tr><td>${2:Value}</td></tr>',
      '  </tbody>',
      '</table>'
    ].join('\n'),
    sortText: '17'
  }
]

/**
 * Range covering the abbreviation just typed, including a leading `<` so a
 * snippet never leaves a stray angle bracket behind.
 */
export function completionRange(
  line: string,
  column: number
): { startColumn: number; typed: string } {
  const before = line.slice(0, Math.max(0, column - 1))
  const match = before.match(/[A-Za-z0-9_!:-]*$/)
  const typed = match?.[0] ?? ''
  let startColumn = column - typed.length
  if (typed.length > 0 && startColumn > 1 && before[startColumn - 2] === '<') {
    startColumn -= 1
  }
  return { startColumn, typed }
}

let registered = false

/** Registers the HTML snippet provider once per renderer process. */
export function registerHtmlCompletions(monacoInstance: typeof monaco): void {
  if (registered) return
  registered = true

  monacoInstance.languages.registerCompletionItemProvider('html', {
    triggerCharacters: ['!', '<', ':'],
    provideCompletionItems(model, position) {
      const line = model.getLineContent(position.lineNumber)
      const { startColumn } = completionRange(line, position.column)
      const range = new monacoInstance.Range(
        position.lineNumber,
        startColumn,
        position.lineNumber,
        position.column
      )
      const { CompletionItemKind, CompletionItemInsertTextRule } = monacoInstance.languages
      return {
        suggestions: HTML_SNIPPETS.map((snippet) => ({
          label: snippet.label,
          kind: CompletionItemKind.Snippet,
          detail: snippet.detail,
          documentation: snippet.documentation ?? snippet.detail,
          // `!` is not part of Monaco's HTML word, so filter on the letters
          // after it once the user starts typing DOCTYPE.
          filterText: snippet.label.replace(/^!/, ''),
          insertText: snippet.insertText,
          insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
          sortText: snippet.sortText,
          range
        }))
      }
    }
  })
}
