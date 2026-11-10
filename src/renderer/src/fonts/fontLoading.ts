// Font loading helpers.
//
// @font-face files download lazily: a family is only fetched the first time
// something actually renders with it. That races Monaco — when a font is
// selected before its file has arrived, Monaco measures the *fallback*
// family and caches those metrics, and the editor ends up laid out with the
// wrong widths. Preloading every bundled code font at startup and awaiting
// the selected family before handing it to the editor removes the race.

import { FONTS } from './fonts'

/** Extracts the primary quoted family ("'Victor Mono'") from a CSS stack. */
function primaryFamily(stack: string): string {
  return stack.match(/'([^']+)'/)?.[1] ?? stack
}

/**
 * Ensures the regular, italic, and bold faces of a family stack have been
 * fetched. Resolves once the files are available; never rejects so callers
 * can chain straight to "apply the option".
 */
export async function ensureFontLoaded(stack: string): Promise<void> {
  const family = primaryFamily(stack)
  try {
    // The size in the shorthand is irrelevant to matching — only the
    // family (plus style/weight) decides which @font-face files are
    // fetched. Faces the family doesn't have simply resolve as unmatched.
    await Promise.all([
      document.fonts.load(`14px ${family}`),
      document.fonts.load(`italic 14px ${family}`),
      document.fonts.load(`700 14px ${family}`)
    ])
  } catch {
    // FontFaceSet unavailable or unparseable shorthand — nothing to wait for.
  }
}

/**
 * Fetches every bundled code font at startup so switches in the appearance
 * panel apply instantly, with no first-use download flash.
 */
export function preloadCodeFonts(): void {
  for (const font of FONTS) {
    void ensureFontLoaded(font.family)
  }
}
