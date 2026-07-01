import 'server-only'
import { createClient } from '@supabase/supabase-js'

// service_role anahtarı: asla NEXT_PUBLIC_ değil, asla istemci tarafına sızmamalı
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
