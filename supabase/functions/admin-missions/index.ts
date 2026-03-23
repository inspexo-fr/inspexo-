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
    // Vérifie le JWT de l'appelant
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

    // Client service_role pour bypasser le RLS
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const method = req.method

    // GET — liste toutes les missions + email client
    if (method === 'GET') {
      const { data, error } = await admin
        .from('missions')
        .select('*, profiles(email)')
        .order('created_at', { ascending: false })

      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors })
      return new Response(JSON.stringify({ missions: data }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    // PATCH — met à jour statut ou expert_id
    if (method === 'PATCH') {
      const { id, ...fields } = await req.json()
      if (!id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: cors })

      const { data, error } = await admin
        .from('missions')
        .update(fields)
        .eq('id', id)
        .select()
        .single()

      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors })
      return new Response(JSON.stringify({ mission: data }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: cors })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: cors })
  }
})
