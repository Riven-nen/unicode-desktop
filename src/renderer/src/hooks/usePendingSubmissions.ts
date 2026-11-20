import { useEffect, useState } from 'react'
import { listPendingSubmissions, subscribePendingSubmissions } from '../lib/submissionQueue'
import type { PendingSubmission } from '../lib/submissionQueue'

/** Live view of the offline submission queue. */
export function usePendingSubmissions(): PendingSubmission[] {
  const [items, setItems] = useState<PendingSubmission[]>(() => listPendingSubmissions())

  useEffect(() => {
    return subscribePendingSubmissions(() => {
      setItems(listPendingSubmissions())
    })
  }, [])

  return items
}
