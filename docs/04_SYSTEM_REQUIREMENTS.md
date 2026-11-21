# Unicode Lab — System Requirements

## Table 1. Software and platform requirements

| Component | Requirement | Description |
|---|---|---|
| Operating System | Windows 10/11 (primary); Linux (development) | Environment for system development and operation. Windows is the packaged target; macOS builds are currently untested. |
| Web Server | Vite dev server; Nginx or static hosting in production | Serves the separate admin web console. The desktop app loads bundled local assets and does not require a web server. Supabase provides the managed API layer. |
| Back-end Framework | Supabase (PostgreSQL, Auth, Realtime, RLS) | Provides authentication, database access, realtime updates, and row-level authorization. The clients use the publishable key; no custom application server is required. |
| Database | PostgreSQL 15+ (Supabase-managed) | Stores profiles, roles, classes, enrollments, assignments, test cases, code snapshots, paste events, typing intervals, authorship and focus counters, submissions, grades, ICS scores, comments, notifications, and invite records. |
| Storage | Local filesystem + Supabase PostgreSQL | Workspace source files live on the student's disk under `Documents/Unicode Lab`. Snapshots, submissions, and monitoring records are stored as PostgreSQL rows; no separate object store is used. |
| Front-end | Electron + React 19 + TypeScript + Monaco Editor; React + Vite for the admin console | Provides the desktop workspace, professor dashboard, and browser-based admin interface. Monaco supplies code editing and language tooling. |
| Dependency Manager | npm (Node.js) | Installs and locks JavaScript/TypeScript dependencies through `package.json` and `package-lock.json`. |

## Explanation

As shown in Table 1, Unicode Lab is implemented as a **desktop-first
client–server system**. The student and professor surfaces run as an Electron
application because the coursework workflow needs native filesystem access,
local terminal execution, offline-tolerant capture, and a code editor that
behaves like a desktop IDE. React and TypeScript provide the component model
and type safety for the interface, while Monaco Editor supplies the editing
surface, syntax highlighting, diagnostics, and language-server integration.

Supabase acts as the back-end platform rather than a custom application server.
It provides managed PostgreSQL, authentication, session handling, realtime
updates, and row-level security (RLS). Both clients use only the publishable
API key; authorization is enforced in the database through RLS policies and
security-definer functions, so a separate REST or GraphQL server is unnecessary.
This reduces deployment complexity and keeps the security boundary close to the
data.

Storage is intentionally split. Source files remain on the local machine so
students can work with real files, use their installed compilers, and continue
editing if the network is unavailable. Authorship telemetry, submissions,
grades, ICS results, comments, and administrative records are persisted in
PostgreSQL. A local sync queue buffers writes and retries them when connectivity
returns.

The **web server** is only needed for the separate admin console. In development
it is served by Vite; in production the built static files can be hosted by
Nginx or another static host. The Electron application itself loads bundled
local assets and does not depend on a remote web server. Judge0 remains an
optional external execution service; when it is unavailable, the desktop app
can still compile and run files with the locally installed toolchain.

Finally, npm is used as the dependency manager for the desktop app and the admin
console. It records exact dependency versions in `package-lock.json`, which
supports reproducible builds.
