import { createClient, type Session } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !publishableKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient<Database>(url, publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

// Returns a valid session, refreshing if needed. If the refresh token is also
// dead (common after a mobile tab is suspended for hours) it clears the stale
// tokens and returns null so the caller can prompt a clean re-login.
export async function tryRecoverSession(): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (session) return session
  const { data: refreshed } = await supabase.auth.refreshSession()
  if (refreshed.session) return refreshed.session
  await supabase.auth.signOut()
  return null
}

export function isAuthError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  if (error.code === 'PGRST301' || error.code === '401') return true
  const message = error.message?.toLowerCase() ?? ''
  return message.includes('jwt') || message.includes('token') || message.includes('not authenticated')
}
