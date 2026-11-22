#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/**
 * Snapshot retention / pruning.
 *
 * Dry run (default):
 *   npm run prune:snapshots -- --days 30
 *   npm run prune:snapshots -- --class CS101 --days 14
 *   npm run prune:snapshots -- --submission <uuid>
 *
 * Apply:
 *   npm run prune:snapshots -- --days 30 --apply
 *
 * The RPC computes and freezes the ICS before deleting anything, then keeps
 * the final, paste, manual, restore, comment-anchored, and paste-event
 * snapshots. Only redundant auto snapshots are removed.
 */
import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!URL || !SERVICE) {
  console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (use --env-file=.env).')
  process.exit(1)
}

const args = process.argv.slice(2)
const has = (name) => args.includes(name)
const value = (name) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

if (has('--help') || has('-h')) {
  console.log(`Usage: node scripts/prune-snapshots.mjs [options]

  --days N           Only submissions submitted at least N days ago (default 30, 0 = all)
  --class CODE|NAME  Limit to one class
  --assignment UUID  Limit to one assignment
  --submission UUID  Limit to one submission (default --days 0)
  --auto-per-hour N  Keep N auto snapshots per file per hour (default 1, 0 = milestones only)
  --limit N          Maximum submissions to inspect (default 1000)
  --apply            Delete the redundant auto snapshots (default is a dry run)
  --dry-run          Explicit dry run
`)
  process.exit(0)
}

const apply = has('--apply') && !has('--dry-run')
const submissionId = value('--submission')
const assignmentId = value('--assignment')
const classKey = value('--class')
const autoPerHour = Number(value('--auto-per-hour') ?? 1)
const limit = Number(value('--limit') ?? 1000)
const days = Number(value('--days') ?? (submissionId ? 0 : 30))

if (!Number.isInteger(autoPerHour) || autoPerHour < 0 || autoPerHour > 60) {
  console.error('--auto-per-hour must be a whole number from 0 to 60.')
  process.exit(1)
}
if (!Number.isFinite(days) || days < 0) {
  console.error('--days must be zero or more.')
  process.exit(1)
}
if (!Number.isFinite(limit) || limit < 1) {
  console.error('--limit must be at least 1.')
  process.exit(1)
}

const service = createClient(URL, SERVICE, { auth: { persistSession: false } })

const formatBytes = (bytes) => {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = Number(bytes)
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

async function resolveClassId(key) {
  const byCode = await service
    .from('classes')
    .select('id, code, name')
    .eq('code', key)
    .maybeSingle()
  if (byCode.error) throw new Error(byCode.error.message)
  if (byCode.data) return byCode.data
  const byName = await service
    .from('classes')
    .select('id, code, name')
    .eq('name', key)
    .maybeSingle()
  if (byName.error) throw new Error(byName.error.message)
  return byName.data
}

async function loadSubmissions() {
  let query = service
    .from('submissions')
    .select(
      'id, submitted_at, assignment_id, student_id, snapshots_pruned_at, ics:ics_scores(submission_id)'
    )
    .order('submitted_at', { ascending: true })
    .limit(limit)

  if (submissionId) query = query.eq('id', submissionId)
  if (assignmentId) query = query.eq('assignment_id', assignmentId)

  if (classKey) {
    const klass = await resolveClassId(classKey)
    if (!klass) throw new Error(`Class not found: ${classKey}`)
    const assignments = await service.from('assignments').select('id').eq('class_id', klass.id)
    if (assignments.error) throw new Error(assignments.error.message)
    const ids = (assignments.data ?? []).map((row) => row.id)
    if (ids.length === 0) return { rows: [], classLabel: klass.name }
    query = query.in('assignment_id', ids)
    return { rows: await runQuery(query), classLabel: klass.name }
  }

  return { rows: await runQuery(query), classLabel: null }
}

async function runQuery(query) {
  let scoped = query
  if (days > 0) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    scoped = scoped.lte('submitted_at', cutoff)
  }
  const { data, error } = await scoped
  if (error) throw new Error(error.message)
  return data ?? []
}

async function main() {
  const { rows, classLabel } = await loadSubmissions()

  const assignmentIds = [...new Set(rows.map((row) => row.assignment_id))]
  const assignmentTitles = new Map()
  if (assignmentIds.length > 0) {
    const { data, error } = await service
      .from('assignments')
      .select('id, title')
      .in('id', assignmentIds)
    if (error) throw new Error(error.message)
    for (const row of data ?? []) assignmentTitles.set(row.id, row.title)
  }

  console.log(
    `${apply ? 'APPLY' : 'DRY RUN'} · ${rows.length} submission(s)` +
      ` · ${classLabel ? `${classLabel} · ` : ''}` +
      `${days === 0 ? 'all ages' : `submitted ≥ ${days} day(s) ago`}` +
      ` · keep ${autoPerHour} auto/hour`
  )

  const totals = { kept: 0, deleted: 0, freed: 0, pruned: 0, skipped: 0, missingIcs: 0 }

  for (const row of rows) {
    if (row.snapshots_pruned_at) {
      totals.skipped += 1
      continue
    }

    const hasIcs = Array.isArray(row.ics) ? row.ics.length > 0 : Boolean(row.ics)
    if (!hasIcs) {
      totals.missingIcs += 1
      continue
    }

    const { data, error } = await service.rpc('prune_submission_snapshots', {
      target_submission: row.id,
      retain_auto_per_hour: autoPerHour,
      dry_run: !apply
    })
    if (error) throw new Error(`${row.id}: ${error.message}`)

    const result = Array.isArray(data) ? data[0] : data
    if (!result) continue

    totals.kept += Number(result.kept_snapshots ?? 0)
    totals.deleted += Number(result.deleted_snapshots ?? 0)
    totals.freed += Number(result.freed_bytes ?? 0)
    if (result.already_pruned) totals.pruned += 1

    const title = assignmentTitles.get(row.assignment_id) ?? row.assignment_id
    console.log(
      `  ${apply ? 'deleted' : 'would delete'} ${result.deleted_snapshots}` +
        ` · keep ${result.kept_snapshots} · ${formatBytes(result.freed_bytes)}` +
        ` · ${title} · ${row.id}`
    )
  }

  console.log(
    `${apply ? 'Deleted' : 'Would delete'} ${totals.deleted} snapshot(s), ` +
      `freeing about ${formatBytes(totals.freed)} of content ` +
      `(${totals.kept} kept, ${totals.skipped} already pruned, ` +
      `${totals.missingIcs} skipped without an ICS).`
  )
  if (!apply) {
    console.log('Dry run only. Re-run with --apply to delete.')
  }
}

main().catch((error) => {
  console.error('Prune failed:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
