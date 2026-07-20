// Supabase Edge Function: send-transfer-email
// Sends the recipient a "your parcel is ready" email via Resend.
//
// Deploy with:
//   supabase functions deploy send-transfer-email
// Set the secret it needs with:
//   supabase secrets set RESEND_API_KEY=re_your_key_here
//
// If RESEND_API_KEY isn't set, this responds 200 with skipped: true instead
// of erroring, so a missing/incomplete email setup never blocks sending the
// parcel itself — email is a nice-to-have on top of the link/code.

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_ADDRESS = Deno.env.get('TRANSFER_EMAIL_FROM') || 'Parcel <parcel@resend.dev>'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { to, code, url } = await req.json()

    if (!to || !code || !url) {
      return new Response(JSON.stringify({ error: 'Missing to, code, or url' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ skipped: true, reason: 'RESEND_API_KEY not configured' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to,
        subject: `A parcel is waiting for you (${code})`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <p>Someone sent you a parcel.</p>
            <p style="font-size: 28px; font-weight: 700; letter-spacing: 0.05em; margin: 24px 0;">${code}</p>
            <p><a href="${url}" style="background:#3654FF;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;">Open parcel</a></p>
            <p style="color:#888;font-size:13px;">Or copy this link: ${url}</p>
          </div>
        `,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Resend error: ${errText}`)
    }

    return new Response(JSON.stringify({ sent: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
