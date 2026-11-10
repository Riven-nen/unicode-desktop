import { useContext } from 'react'
import { FontContext, type FontContextValue } from './font-context'

export function useFont(): FontContextValue {
  const context = useContext(FontContext)
  if (!context) throw new Error('useFont must be used within FontProvider')
  return context
}
