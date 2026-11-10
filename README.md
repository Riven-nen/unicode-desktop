# unicode-desktop

An Electron application with React and TypeScript

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```

## Time-Travel Diff & Paste Tracker

The editor captures every meaningful change as a snapshot (`auto`, `paste`, `manual`, or
`restore`) using Monaco's `onDidChangeContent` and `onDidPaste` events. A typing-velocity
heuristic also flags large insert bursts that bypass the clipboard (drag-drop, middle-click
paste). The **Time Travel** rail below the editor lets students browse snapshots, diff any
moment against the previous snapshot or the current file, and restore old versions — every
restore is itself recorded as a new snapshot, so history is never lost.

### Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Run `supabase/schema.sql` in the project's SQL editor.
3. Copy `.env.example` to `.env` and fill in your project URL and anon key.
4. Promote professor accounts when needed:
   `update profiles set role = 'professor' where email = '...';`

Students sign in from the app's top bar. Without a `.env` (or before signing in), the app runs
in **local-only mode**: snapshots and paste events queue in `localStorage` and sync
automatically once Supabase is configured and the student signs in on the same device. All
tables are protected by row-level security — the app only ever ships the anon key.
