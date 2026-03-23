import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ADMIN_EMAILS = ['contact@inspexo.io']

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Missing token' }), { status: 401, headers: cors })

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: authError } = await anonClient.auth.getUser()
    if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors })
    if (!ADMIN_EMAILS.includes(user.email ?? '')) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: cors })
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const method = req.method

    // GET — liste toutes les candidatures
    if (method === 'GET') {
      const { data, error } = await admin
        .from('expert_applications')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors })
      return new Response(JSON.stringify({ applications: data }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    // PATCH — approuver / rejeter
    if (method === 'PATCH') {
      const { id, status } = await req.json()
      if (!id || !status) return new Response(JSON.stringify({ error: 'Missing id or status' }), { status: 400, headers: cors })

      const { data, error } = await admin
        .from('expert_applications')
        .update({ status })
        .eq('id', id)
        .select()
        .single()

      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors })
      return new Response(JSON.stringify({ application: data }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: cors })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: cors })
  }
})
