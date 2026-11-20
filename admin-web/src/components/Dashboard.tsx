import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Ban,
  BookOpen,
  Copy,
  GraduationCap,
  KeyRound,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Users
} from 'lucide-react'
import {
  createProfessorInvite,
  fetchClasses,
  fetchProfessorInvites,
  fetchProfiles,
  inviteStatus,
  revokeProfessorInvite,
  setUserRole
} from '../lib/adminQueries'
import type {
  AdminClass,
  AdminProfile,
  CreatedProfessorInvite,
  InviteStatus,
  ProfessorInvite,
  Role
} from '../lib/adminQueries'

interface DashboardProps {
  profile: AdminProfile
  onSignOut: () => void
}

const ROLE_LABEL: Record<Role, string> = {
  student: 'Student',
  professor: 'Professor',
  admin: 'Admin'
}

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })

const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

const INVITE_STATUS_LABEL: Record<InviteStatus, string> = {
  active: 'Active',
  expired: 'Expired',
  revoked: 'Revoked',
  used: 'Used up'
}

export default function Dashboard({ profile, onSignOut }: DashboardProps): React.ReactElement {
  const [users, setUsers] = useState<AdminProfile[]>([])
  const [classes, setClasses] = useState<AdminClass[]>([])
  const [invites, setInvites] = useState<ProfessorInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [roleError, setRoleError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [copiedInvite, setCopiedInvite] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  // Invite builder state.
  const [inviteNote, setInviteNote] = useState('')
  const [lifespanValue, setLifespanValue] = useState('7')
  const [lifespanUnit, setLifespanUnit] = useState<'hours' | 'days'>('days')
  const [inviteUses, setInviteUses] = useState('1')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [createdInvite, setCreatedInvite] = useState<CreatedProfessorInvite | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const fetchAll = useCallback(
    () => Promise.all([fetchProfiles(), fetchClasses(), fetchProfessorInvites()]),
    []
  )

  const load = useCallback(async (): Promise<void> => {
    try {
      const [nextUsers, nextClasses, nextInvites] = await fetchAll()
      setUsers(nextUsers)
      setClasses(nextClasses)
      setInvites(nextInvites)
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load admin data.')
    } finally {
      setLoading(false)
    }
  }, [fetchAll])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let cancelled = false
    void fetchAll()
      .then(([nextUsers, nextClasses, nextInvites]) => {
        if (cancelled) return
        setUsers(nextUsers)
        setClasses(nextClasses)
        setInvites(nextInvites)
        setError(null)
      })
      .catch((loadError) => {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : 'Could not load admin data.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [fetchAll])

  const stats = useMemo(
    () => ({
      users: users.length,
      professors: users.filter((user) => user.role === 'professor').length,
      admins: users.filter((user) => user.role === 'admin').length,
      classes: classes.length,
      activeInvites: invites.filter((invite) => inviteStatus(invite, now) === 'active').length
    }),
    [users, classes, invites, now]
  )

  const visibleUsers = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return users.filter((user) => {
      if (roleFilter !== 'all' && user.role !== roleFilter) return false
      if (!needle) return true
      return (
        user.displayName.toLowerCase().includes(needle) ||
        (user.email ?? '').toLowerCase().includes(needle)
      )
    })
  }, [users, search, roleFilter])

  const changeRole = async (
    user: AdminProfile,
    nextRole: Role,
    select: HTMLSelectElement
  ): Promise<void> => {
    select.value = user.role
    if (nextRole === user.role) return
    if (user.id === profile.id) {
      setRoleError('You cannot change your own role.')
      return
    }
    const confirmed = window.confirm(
      `Change ${user.displayName || user.email} from ${ROLE_LABEL[user.role]} to ${ROLE_LABEL[nextRole]}?`
    )
    if (!confirmed) return

    setBusyId(user.id)
    setRoleError(null)
    try {
      await setUserRole(user.id, nextRole)
      await load()
    } catch (changeError) {
      setRoleError(
        changeError instanceof Error ? changeError.message : 'Could not change the role.'
      )
    } finally {
      setBusyId(null)
    }
  }

  const copyJoinCode = async (code: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
      window.setTimeout(() => setCopiedCode(null), 1500)
    } catch {
      setCopiedCode(null)
    }
  }

  const copyInviteCode = async (code: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedInvite(code)
      window.setTimeout(() => setCopiedInvite(null), 1500)
    } catch {
      setCopiedInvite(null)
    }
  }

  const createInvite = async (): Promise<void> => {
    const lifespan = Number(lifespanValue)
    const uses = Number(inviteUses)
    if (!Number.isInteger(lifespan) || lifespan < 1) {
      setInviteError('Enter a lifespan of at least 1.')
      return
    }
    const lifespanHours = lifespanUnit === 'days' ? lifespan * 24 : lifespan
    if (lifespanHours > 8760) {
      setInviteError('The lifespan cannot exceed 365 days.')
      return
    }
    if (!Number.isInteger(uses) || uses < 1 || uses > 1000) {
      setInviteError('Choose between 1 and 1000 uses.')
      return
    }

    setInviteBusy(true)
    setInviteError(null)
    setCreatedInvite(null)
    try {
      const created = await createProfessorInvite({
        lifespanHours,
        maxUses: uses,
        note: inviteNote
      })
      setCreatedInvite(created)
      setInvites(await fetchProfessorInvites())
      setInviteNote('')
    } catch (createError) {
      setInviteError(
        createError instanceof Error ? createError.message : 'Could not create the invite.'
      )
    } finally {
      setInviteBusy(false)
    }
  }

  const revokeInvite = async (invite: ProfessorInvite): Promise<void> => {
    if (
      !window.confirm(
        `Revoke ${invite.code}? Anyone still holding this code will not be able to use it.`
      )
    ) {
      return
    }
    setRevokingId(invite.id)
    setInviteError(null)
    try {
      await revokeProfessorInvite(invite.id)
      setInvites(await fetchProfessorInvites())
    } catch (revokeError) {
      setInviteError(
        revokeError instanceof Error ? revokeError.message : 'Could not revoke the invite.'
      )
    } finally {
      setRevokingId(null)
    }
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="brand">
          <span className="brand-mark">
            <ShieldCheck size={17} />
          </span>
          <div>
            <strong>Unicode Lab</strong>
            <span className="brand-sub">Admin console</span>
          </div>
        </div>
        <div className="header-user">
          <span>{profile.displayName}</span>
          <span className="muted">{profile.email}</span>
          <button className="btn ghost" onClick={onSignOut}>
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </header>

      <main className="admin-main">
        <div className="page-head">
          <div>
            <span className="eyebrow">Operations</span>
            <h1>Accounts and classes</h1>
            <p className="muted">
              Generate professor invites, review roles, and check class join codes. Submissions and
              student code are never exposed here.
            </p>
          </div>
          <button
            className="btn"
            onClick={() => {
              setLoading(true)
              setError(null)
              void load()
            }}
            disabled={loading}
          >
            <RefreshCw size={13} /> {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        <section className="stat-grid">
          <article className="stat-card">
            <Users size={16} />
            <strong>{stats.users}</strong>
            <span>Users</span>
          </article>
          <article className="stat-card">
            <GraduationCap size={16} />
            <strong>{stats.professors}</strong>
            <span>Professors</span>
          </article>
          <article className="stat-card">
            <ShieldCheck size={16} />
            <strong>{stats.admins}</strong>
            <span>Admins</span>
          </article>
          <article className="stat-card">
            <BookOpen size={16} />
            <strong>{stats.classes}</strong>
            <span>Classes</span>
          </article>
          <article className="stat-card">
            <KeyRound size={16} />
            <strong>{stats.activeInvites}</strong>
            <span>Active invites</span>
          </article>
        </section>

        {error && <div className="notice error">{error}</div>}
        {roleError && <div className="notice error">{roleError}</div>}

        <section className="panel">
          <header className="panel-head">
            <h2>Professor invites</h2>
            <span className="muted">
              {stats.activeInvites} active · {invites.length} total
            </span>
          </header>

          <form
            className="invite-form"
            onSubmit={(event) => {
              event.preventDefault()
              void createInvite()
            }}
          >
            <label className="invite-field invite-note">
              <span>Note (optional)</span>
              <input
                placeholder="e.g. Prof. Cruz"
                maxLength={120}
                value={inviteNote}
                onChange={(event) => setInviteNote(event.target.value)}
              />
            </label>
            <label className="invite-field invite-lifespan">
              <span>Lifespan</span>
              <span className="invite-inline">
                <input
                  type="number"
                  min={1}
                  max={lifespanUnit === 'days' ? 365 : 8760}
                  step={1}
                  value={lifespanValue}
                  onChange={(event) => setLifespanValue(event.target.value)}
                  aria-label="Invite lifespan"
                />
                <select
                  value={lifespanUnit}
                  onChange={(event) => setLifespanUnit(event.target.value as 'hours' | 'days')}
                  aria-label="Lifespan unit"
                >
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                </select>
              </span>
            </label>
            <label className="invite-field invite-uses">
              <span>Max uses</span>
              <input
                type="number"
                min={1}
                max={1000}
                step={1}
                value={inviteUses}
                onChange={(event) => setInviteUses(event.target.value)}
                aria-label="Maximum uses"
              />
            </label>
            <button className="btn primary invite-submit" type="submit" disabled={inviteBusy}>
              <Plus size={13} /> {inviteBusy ? 'Generating…' : 'Generate code'}
            </button>
          </form>

          {inviteError && <div className="notice error invite-notice">{inviteError}</div>}

          {createdInvite && (
            <div className="invite-created">
              <div>
                <span className="eyebrow">New professor code</span>
                <div className="invite-code-line">
                  <code>{createdInvite.code}</code>
                  <button
                    className="icon-btn"
                    title="Copy invite code"
                    onClick={() => void copyInviteCode(createdInvite.code)}
                  >
                    <Copy size={13} />
                  </button>
                  {copiedInvite === createdInvite.code && <span className="copied">Copied</span>}
                </div>
                <span className="muted">
                  Expires {formatDateTime(createdInvite.expiresAt)} · up to {createdInvite.maxUses}{' '}
                  {createdInvite.maxUses === 1 ? 'use' : 'uses'}
                </span>
              </div>
            </div>
          )}

          {invites.length === 0 ? (
            <div className="empty">No professor invites have been generated yet.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Status</th>
                    <th>Uses</th>
                    <th>Expires</th>
                    <th>Note</th>
                    <th>Created</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {invites.map((invite) => {
                    const status = inviteStatus(invite, now)
                    return (
                      <tr key={invite.id}>
                        <td>
                          <span className="join-code">
                            <KeyRound size={12} />
                            {invite.code}
                            <button
                              className="icon-btn"
                              title="Copy invite code"
                              onClick={() => void copyInviteCode(invite.code)}
                            >
                              <Copy size={12} />
                            </button>
                            {copiedInvite === invite.code && <span className="copied">Copied</span>}
                          </span>
                        </td>
                        <td>
                          <span className={`badge invite-${status}`}>
                            {INVITE_STATUS_LABEL[status]}
                          </span>
                        </td>
                        <td className="muted">
                          {invite.uses}/{invite.maxUses}
                        </td>
                        <td className="muted">{formatDateTime(invite.expiresAt)}</td>
                        <td className="muted">{invite.note ?? '—'}</td>
                        <td className="muted">{formatDate(invite.createdAt)}</td>
                        <td>
                          {invite.revokedAt ? (
                            <span className="muted">Revoked</span>
                          ) : (
                            <button
                              className="btn ghost invite-revoke"
                              onClick={() => void revokeInvite(invite)}
                              disabled={revokingId === invite.id}
                            >
                              <Ban size={12} />
                              {revokingId === invite.id ? 'Revoking…' : 'Revoke'}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel">
          <header className="panel-head">
            <h2>Users</h2>
            <div className="panel-tools">
              <label className="search">
                <Search size={13} />
                <input
                  placeholder="Search name or email"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as Role | 'all')}
              >
                <option value="all">All roles</option>
                <option value="student">Students</option>
                <option value="professor">Professors</option>
                <option value="admin">Admins</option>
              </select>
            </div>
          </header>

          {loading && users.length === 0 ? (
            <div className="empty">Loading users…</div>
          ) : visibleUsers.length === 0 ? (
            <div className="empty">No users match this filter.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Joined</th>
                    <th>Change role</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleUsers.map((user) => {
                    const isSelf = user.id === profile.id
                    return (
                      <tr key={user.id}>
                        <td>
                          <div className="user-cell">
                            <span className="avatar">
                              {(user.displayName || user.email || '?').slice(0, 2).toUpperCase()}
                            </span>
                            <span>
                              <strong>{user.displayName}</strong>
                              <span className="muted">{user.email ?? 'No email'}</span>
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${user.role}`}>{ROLE_LABEL[user.role]}</span>
                          {isSelf && <span className="you">You</span>}
                        </td>
                        <td className="muted">{formatDate(user.createdAt)}</td>
                        <td>
                          <select
                            defaultValue={user.role}
                            disabled={isSelf || busyId === user.id}
                            onChange={(event) =>
                              void changeRole(user, event.target.value as Role, event.currentTarget)
                            }
                          >
                            <option value="student">Student</option>
                            <option value="professor">Professor</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel">
          <header className="panel-head">
            <h2>Classes</h2>
            <span className="muted">{classes.length} total</span>
          </header>

          {loading && classes.length === 0 ? (
            <div className="empty">Loading classes…</div>
          ) : classes.length === 0 ? (
            <div className="empty">No classes yet.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Professor</th>
                    <th>Join code</th>
                    <th>Students</th>
                    <th>Assignments</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map((klass) => (
                    <tr key={klass.id}>
                      <td>
                        <div className="class-cell">
                          <strong>
                            {klass.code} · {klass.name}
                          </strong>
                          {klass.archivedAt && <span className="badge archived">Archived</span>}
                        </div>
                      </td>
                      <td>
                        <div className="user-cell compact">
                          <span>
                            <strong>{klass.professorName}</strong>
                            <span className="muted">{klass.professorEmail ?? 'No email'}</span>
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="join-code">
                          <KeyRound size={12} />
                          {klass.joinCode}
                          <button
                            className="icon-btn"
                            title="Copy join code"
                            onClick={() => void copyJoinCode(klass.joinCode)}
                          >
                            <Copy size={12} />
                          </button>
                          {copiedCode === klass.joinCode && <span className="copied">Copied</span>}
                        </span>
                      </td>
                      <td>{klass.studentCount}</td>
                      <td>{klass.assignmentCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="footer-note">
          Role changes are enforced by <code>admin_set_role</code>. Demoting a professor requires
          their classes to be reassigned or deleted first, and you cannot change your own role.
          Invite creation and revocation are restricted to admins; codes expire and stop working
          after their usage limit.
        </p>
      </main>
    </div>
  )
}
