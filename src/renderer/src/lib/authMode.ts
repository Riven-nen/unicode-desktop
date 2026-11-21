/**
 * Email confirmation policy.
 *
 * Development defaults to immediate access so local QA does not need a real
 * inbox. Production builds default to requiring confirmation. The explicit
 * VITE_AUTH_EMAIL_CONFIRMATION override exists for projects that deliberately
 * differ, but the Supabase Auth "Confirm email" setting is still the source of
 * truth for whether a confirmation email is actually sent.
 */
export const emailConfirmationRequired: boolean = (() => {
  const explicit = import.meta.env.VITE_AUTH_EMAIL_CONFIRMATION
  if (explicit === 'true') return true
  if (explicit === 'false') return false
  return import.meta.env.PROD
})()
