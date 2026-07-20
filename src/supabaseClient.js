import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    'Missing Supabase env vars. Create a .env file from .env.example and set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const SUPABASE_URL = supabaseUrl
export const SUPABASE_ANON_KEY = supabaseAnonKey
export const BUCKET = 'parcels'
export const TABLE = 'transfers'

// A transfer expires this many days after creation by default.
export const DEFAULT_EXPIRY_DAYS = 7

// This is a UI-side ceiling, not the real limit. The real ceiling is set in
// Supabase: Storage Settings > Global file size limit (50MB hard cap on the
// Free plan, up to 500GB on Pro+). Raise or lower this to match whatever
// you've actually configured there -- see README.
export const MAX_TOTAL_BYTES = 50 * 1024 * 1024 * 1024 // 50GB soft UI ceiling

// Generates a short, human-typeable tracking code, e.g. "7K2-N9Q4"
export function generateTrackingCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no O/0/I/1 ambiguity
  const part = (len) =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `${part(3)}-${part(4)}`
}

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '\u2014'
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}
