import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifierAdmin } from '../_shared/adminAuth.ts'


const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    // Rôle admin vérifié en base (table admins) — sprint 3.1.
    const acces = await verifierAdmin(req)
    if (!acces.ok) return new Response(JSON.stringify({ error: acces.error }), { status: acces.status, headers: cors })
    const user = acces.user

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
