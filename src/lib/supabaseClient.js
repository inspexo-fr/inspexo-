import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase env vars manquantes — vérifiez .env.local')
  console.error('REACT_APP_SUPABASE_URL     :', supabaseUrl ?? 'UNDEFINED')
  console.error('REACT_APP_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✓ présente' : 'UNDEFINED')
} else {
  console.info('✅ Supabase initialisé —', supabaseUrl)
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
