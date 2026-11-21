import type * as monaco from 'monaco-editor'

/**
 * Editor typing defaults shared by the workspace and the ICS playground.
 * HTML gets tag auto-closing and bracket/quote pairing; format-on-type and
 * format-on-paste make the HTML/CSS language services useful while editing.
 */
export const EDITOR_TYPING_OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
  autoClosingBrackets: 'languageDefined',
  autoClosingQuotes: 'languageDefined',
  autoClosingOvertype: 'always',
  autoIndent: 'full',
  formatOnPaste: true,
  formatOnType: true,
  quickSuggestions: { other: true, comments: false, strings: true },
  suggestOnTriggerCharacters: true,
  acceptSuggestionOnEnter: 'on',
  snippetSuggestions: 'top',
  tabCompletion: 'on',
  wordBasedSuggestions: 'currentDocument',
  suggestSelection: 'first'
}
