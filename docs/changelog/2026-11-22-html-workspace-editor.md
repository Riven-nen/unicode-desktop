# Overall Summary: HTML Course, Multi-File Projects, Live Preview, and Editor Typing

**Date:** 2026-11-22

## Overall summary

This batch makes HTML a first-class subject in the lab. It adds the HTML101
course, nested project folders, image assets, a loopback live preview for real
class folders, and editor typing fixes for HTML and CSS. It also reconciles the
demo seed with the live ICS v3 evidence model and repairs timed-assessment
snapshot attachment.

## HTML101 and multi-file projects

- Added `HTML101 - Web Foundations` with five lessons and a profile-page project.
- Assignment file names may contain project paths such as
  `profile-project/index.html`; opening one creates the nested folder.
- The class tree is recursive and supports:
  - new files and new folders in any class/project folder
  - PNG/JPG/JPEG/GIF/WebP/SVG/ICO/BMP/AVIF image import
  - collision-safe image names
  - image icons, rename, delete, and open-in-system-viewer
- The seeded HTML101 project links `styles.css` and `script.js` from its own
  project folder.

## Live HTML preview

- HTML files open a **Preview** tab in the bottom panel by default.
- A loopback-only static server serves the active project folder, so relative
  CSS, JS, images, and other assets work.
- The active HTML file is overlaid with unsaved editor content.
- Preview updates after a short debounce; Refresh and Browser actions are
  available.
- Closing the preview or the app stops the server.
- The ICS playground uses the same server with a temporary document.

## Editor typing and completion

- Added HTML snippets for:
  - `!DOCTYPE` / `!doctype` / `html:5`
  - `link:css`, `script:src`, `img`, `a`, `ul>li`, `form`, `label+input`, `table`
- `!DOCTYPE` inserts a complete document skeleton with tab stops.
- Normal opening tags auto-insert their closing tag; void and self-closing tags
  are skipped, and existing closing tags are not duplicated.
- Enabled format-on-type, format-on-paste, trigger-character suggestions,
  snippet-first suggestions, Tab completion, and full auto-indent for the
  workspace and ICS playground editors.

## Data and demo alignment

- Seeded snapshots now include synthetic `edit_stats` and `focus_stats`.
- The seed signs in as the demo professor and runs the live v3 `recompute_ics`
  RPC instead of carrying a copy of the formula.
- Seeded ICS v3 outcomes: student1 pass 95.0, student2 review 79.6, student3
  flag 5.0.
- Fixed timed-assessment finalization so class-prefixed tracker snapshots such
  as `CS101/test.py` attach to the submission. The existing test submission was
  repaired.

## Verification

- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run test` passes: 18 files, 121 tests.
- `npm run build` passes.
- Seed rerun completes and validates the v3 demo bands.
- HTML completion range, snippet presence, tag auto-close, nested listing, nested
  assignment paths, and preview server behavior have unit coverage.
