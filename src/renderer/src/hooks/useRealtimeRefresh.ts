import { useEffect, useRef } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

/**
 * Refreshes a dashboard shortly after any subscribed table changes. Pass a
 * stable table list (module constant) so the channel is not re-created on
 * every render. RLS still applies to the delivered rows.
 */
export function useRealtimeRefresh(
  session: Session | null,
  tables: readonly string[],
  onChange: () => void
): void {
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  const tablesKey = tables.join(',')

  useEffect(() => {
    if (!session || !supabase) return
    let timer: ReturnType<typeof setTimeout> | null = null

    const schedule = (): void => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        onChangeRef.current()
      }, 500)
    }

    const channel = supabase.channel(`db-refresh:${session.user.id}:${tablesKey}`)
    for (const table of tables) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, schedule)
    }
    channel.subscribe()

    return () => {
      if (timer) clearTimeout(timer)
      void supabase?.removeChannel(channel)
    }
  }, [session, tablesKey, tables])
}
