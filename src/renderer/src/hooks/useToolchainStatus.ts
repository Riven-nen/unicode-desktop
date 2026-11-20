import { useCallback, useEffect, useState } from 'react'
import type { ToolchainStatus } from '../../../shared/toolchains'

interface Snapshot {
  language: string
  status: ToolchainStatus
}

/**
 * Checks the local compiler/runtime for the active editor language. The main
 * process caches results per language; `recheck` forces a fresh lookup after
 * the student installs something.
 */
export function useToolchainStatus(language: string): {
  status: ToolchainStatus | null
  recheck: () => void
} {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)

  useEffect(() => {
    if (!language) return
    let cancelled = false
    void window.api.toolchains
      .check(language)
      .then((status) => {
        if (!cancelled) setSnapshot({ language, status })
      })
      .catch(() => {
        // A failed probe is not worth blocking the editor over.
        if (!cancelled) setSnapshot(null)
      })
    return () => {
      cancelled = true
    }
  }, [language])

  const recheck = useCallback((): void => {
    if (!language) return
    void window.api.toolchains
      .check(language, true)
      .then((status) => setSnapshot({ language, status }))
      .catch(() => setSnapshot(null))
  }, [language])

  return {
    status: snapshot?.language === language ? snapshot.status : null,
    recheck
  }
}
