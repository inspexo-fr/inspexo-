import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

interface EmailRequest {
  to: string;
  template: string;
  data?: Record<string, any>;
}

const templates: Record<string, (data: any) => { subject: string; html: string }> = {
  welcome: (_data) => ({
    subject: "Bienvenue sur Inspexo 🚗",
    html: `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: #0F1B2D; padding: 32px; text-align: center;">
          <h1 style="color: #ffffff; font-size: 28px; margin: 0; letter-spacing: 3px;">INSPEXO</h1>
          <p style="color: rgba(255,255,255,0.6); margin: 8px 0 0; font-size: 14px;">Expert automobile à tes côtés</p>
        </div>
        <div style="padding: 32px;">
          <h2 style="color: #0F1B2D; font-size: 22px;">Bienvenue sur Inspexo ! 👋</h2>
          <p style="color: #333; line-height: 1.6; font-size: 15px;">
            Tu as fait le bon choix. Inspexo, c'est un expert automobile spécialisé par marque, 100% de ton côté.
          </p>
          <p style="color: #333; line-height: 1.6; font-size: 15px;">
            Tu peux commencer dès maintenant avec une <strong>analyse IA gratuite</strong> de ton véhicule :
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="https://inspexo.io" style="background: #FF4D00; color: #ffffff; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 16px; display: inline-block;">
              🔍 Analyser mon véhicule
            </a>
          </div>
          <p style="color: #666; font-size: 13px; line-height: 1.5; text-align: center;">
            3 analyses gratuites · 10 échanges par analyse · Rapport partiel inclus
          </p>
        </div>
        <div style="background: #F8F9FA; padding: 24px 32px; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px; margin: 0; text-align: center;">
            Inspexo — Expert automobile spécialisé par marque<br>
            <a href="https://inspexo.io" style="color: #FF4D00;">inspexo.io</a>
          </p>
        </div>
      </div>
    `,
  }),

  payment_confirmation: (data) => ({
    subject: `✅ Paiement confirmé — ${data.tier_label}`,
    html: `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: #0F1B2D; padding: 32px; text-align: center;">
          <h1 style="color: #ffffff; font-size: 28px; margin: 0; letter-spacing: 3px;">INSPEXO</h1>
        </div>
        <div style="padding: 32px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <span style="font-size: 48px;">✅</span>
          </div>
          <h2 style="color: #0F1B2D; font-size: 22px; text-align: center;">Paiement confirmé !</h2>
          <div style="background: #F8F9FA; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <p style="margin: 6px 0; color: #333; font-size: 14px;"><strong>Service :</strong> ${data.tier_label || '—'}</p>
            <p style="margin: 6px 0; color: #333; font-size: 14px;"><strong>Véhicule :</strong> ${data.vehicle || 'Non spécifié'}</p>
            <p style="margin: 6px 0; color: #333; font-size: 14px;"><strong>Montant :</strong> ${data.amount || '—'}€</p>
          </div>
          ${(data.tier === 'visio' || data.tier === 'inspection') ? `
            <p style="color: #333; line-height: 1.6; font-size: 15px;">
              Prochaine étape : réserve ton créneau avec un expert spécialisé.
            </p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="https://inspexo.io" style="background: #FF4D00; color: #ffffff; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 16px; display: inline-block;">
                📅 Réserver mon créneau
              </a>
            </div>
          ` : `
            <p style="color: #333; line-height: 1.6; font-size: 15px;">
              Ton analyse complète est débloquée. Continue ta conversation avec l'expert IA.
            </p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="https://inspexo.io" style="background: #FF4D00; color: #ffffff; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 16px; display: inline-block;">
                💬 Reprendre l'analyse
              </a>
            </div>
          `}
        </div>
        <div style="background: #F8F9FA; padding: 24px 32px; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px; margin: 0; text-align: center;">
            Inspexo — Expert automobile spécialisé par marque<br>
            <a href="https://inspexo.io" style="color: #FF4D00;">inspexo.io</a>
          </p>
        </div>
      </div>
    `,
  }),

  report_ready: (data) => ({
    subject: `📋 Ton rapport ${data.is_partial ? 'partiel' : 'complet'} est prêt — ${data.vehicle}`,
    html: `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: #0F1B2D; padding: 32px; text-align: center;">
          <h1 style="color: #ffffff; font-size: 28px; margin: 0; letter-spacing: 3px;">INSPEXO</h1>
        </div>
        <div style="padding: 32px;">
          <h2 style="color: #0F1B2D; font-size: 22px;">Ton rapport ${data.is_partial ? 'partiel' : 'complet'} est prêt 📋</h2>
          <div style="background: #F8F9FA; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <p style="margin: 6px 0; color: #333; font-size: 14px;"><strong>Véhicule :</strong> ${data.vehicle || '—'}</p>
          </div>
          ${data.is_partial ? `
            <p style="color: #333; line-height: 1.6; font-size: 15px;">
              Ton rapport partiel identifie les points critiques, mais les coûts détaillés et les arguments de négociation sont réservés à l'analyse complète.
            </p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="https://inspexo.io" style="background: #FF4D00; color: #ffffff; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 16px; display: inline-block;">
                🔓 Débloquer le rapport complet — 9,90€
              </a>
            </div>
          ` : `
            <div style="text-align: center; margin: 24px 0;">
              <a href="https://inspexo.io" style="background: #FF4D00; color: #ffffff; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 16px; display: inline-block;">
                📋 Voir mon rapport complet
              </a>
            </div>
          `}
          <div style="background: #FFF0EA; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <p style="color: #0F1B2D; font-size: 14px; margin: 0; line-height: 1.6;">
              <strong>💡 Tu veux être sûr à 100% ?</strong><br>
              Un expert Inspexo spécialisé ${data.brand ? data.brand : ''} peut inspecter le véhicule sur place et te donner un rapport professionnel.
            </p>
            <div style="text-align: center; margin-top: 16px;">
              <a href="https://inspexo.io" style="color: #FF4D00; font-weight: 600; text-decoration: none; font-size: 14px;">
                Réserver un expert → à partir de 59€
              </a>
            </div>
          </div>
        </div>
        <div style="background: #F8F9FA; padding: 24px 32px; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px; margin: 0; text-align: center;">
            Inspexo — Expert automobile spécialisé par marque<br>
            <a href="https://inspexo.io" style="color: #FF4D00;">inspexo.io</a>
          </p>
        </div>
      </div>
    `,
  }),

  free_analysis_ended: (data) => ({
    subject: `🔍 ${data.vehicle} — ${data.critical_count} point(s) critique(s) détecté(s)`,
    html: `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: #0F1B2D; padding: 32px; text-align: center;">
          <h1 style="color: #ffffff; font-size: 28px; margin: 0; letter-spacing: 3px;">INSPEXO</h1>
        </div>
        <div style="padding: 32px;">
          <h2 style="color: #0F1B2D; font-size: 22px;">Ton analyse gratuite est terminée</h2>
          <p style="color: #333; line-height: 1.6; font-size: 15px;">
            L'expert IA a identifié <strong style="color: #FF4D00;">${data.critical_count} point(s) critique(s)</strong> sur ton ${data.vehicle}.
          </p>
          <p style="color: #333; line-height: 1.6; font-size: 15px;">
            Pour obtenir les coûts détaillés de chaque réparation et les arguments de négociation :
          </p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="https://inspexo.io" style="background: #FF4D00; color: #ffffff; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 16px; display: inline-block;">
              🔓 Débloquer l'analyse complète — 9,90€
            </a>
          </div>
          <div style="text-align: center; margin: 16px 0;">
            <a href="https://inspexo.io" style="color: #FF4D00; font-weight: 600; text-decoration: none; font-size: 14px;">
              Ou réserver un expert physique → à partir de 59€
            </a>
          </div>
        </div>
        <div style="background: #F8F9FA; padding: 24px 32px; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px; margin: 0; text-align: center;">
            Inspexo — Expert automobile spécialisé par marque<br>
            <a href="https://inspexo.io" style="color: #FF4D00;">inspexo.io</a>
          </p>
        </div>
      </div>
    `,
  }),
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, template, data }: EmailRequest = await req.json();

    if (!to || !template) {
      return new Response(
        JSON.stringify({ error: "to et template requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const templateFn = templates[template];
    if (!templateFn) {
      return new Response(
        JSON.stringify({ error: `Template "${template}" inconnu` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { subject, html } = templateFn(data || {});

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Inspexo <contact@inspexo.io>",
        to: [to],
        subject,
        html,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Resend error:", result);
      return new Response(
        JSON.stringify({ error: "Erreur envoi email", details: result }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, id: result.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Erreur interne", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
