# Unicode Lab Documentation

This folder contains the paper-ready and QA-facing documentation for the current
Unicode Lab build.

| Document | Purpose |
|---|---|
| [00_PLAIN_LANGUAGE_OVERVIEW.md](00_PLAIN_LANGUAGE_OVERVIEW.md) | Non-technical guide for advisers, panelists, and general readers |
| [01_FEATURE_MASTER_LIST.md](01_FEATURE_MASTER_LIST.md) | Every implemented feature, grouped by category, with stable IDs and status |
| [02_TECHNICAL_OVERVIEW.md](02_TECHNICAL_OVERVIEW.md) | Architecture, data model, subsystems, data flows, security, and build/release details |
| [03_QA_CHECKLIST.md](03_QA_CHECKLIST.md) | Full manual and automated test checklist for demo/release readiness |

## Reading order for the paper

1. Start with **00_PLAIN_LANGUAGE_OVERVIEW.md** for a quick, non-technical
   explanation of the problem, users, workflow, and limits.
2. Use **01_FEATURE_MASTER_LIST.md** for the scope, feature inventory, and
   implemented-versus-not-implemented discussion.
3. Use **02_TECHNICAL_OVERVIEW.md** for methodology, system design, schema,
   security model, and implementation details.
4. Use **03_QA_CHECKLIST.md** for validation evidence and the demo runbook.

## Current snapshot

- Desktop app: Electron 44 + React 19 + TypeScript + Monaco.
- Backend: Supabase Postgres, Auth, Realtime, Row-Level Security.
- Admin console: separate Vite/React web app in `admin-web/`.
- Local execution: PowerShell terminal and local toolchain runner.
- Remote execution: Judge0 integration exists; a live endpoint is an external
  dependency and is not guaranteed in the demo environment.
- Automated checks: 59 Vitest tests and 40 live RLS regression checks.
- Windows installer: `dist/unicode-desktop-1.0.0-setup.exe`.
- Installer SHA-256:
  `36BDD335629533BFC2DE73C93D87EC32F69519B006FF84B36CFAA9BA735F1BA4`.

## Documentation status

These files describe the code in this repository as of 2026-11-20. Update the
version, installer hash, test counts, and known-limitations sections whenever the
build changes.
