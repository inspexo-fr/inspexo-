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

  expert_stripe_onboarding: (data) => ({
    subject: "Inspexo — Finalisez votre inscription pour recevoir vos paiements",
    html: `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: #0F1B2D; padding: 32px; text-align: center;">
          <h1 style="color: #ffffff; font-size: 28px; margin: 0; letter-spacing: 3px;">INSPEXO</h1>
          <p style="color: rgba(255,255,255,0.6); margin: 8px 0 0; font-size: 14px;">Espace Expert</p>
        </div>
        <div style="padding: 40px 32px;">
          <h2 style="color: #0F1B2D; font-size: 22px; margin: 0 0 16px;">Une dernière étape avant de recevoir vos paiements</h2>
          <p style="color: #333; line-height: 1.7; font-size: 15px; margin: 0 0 16px;">
            Bonjour,
          </p>
          <p style="color: #333; line-height: 1.7; font-size: 15px; margin: 0 0 16px;">
            Votre candidature Inspexo a été approuvée. Pour commencer à recevoir vos versements après chaque mission, vous devez finaliser la configuration de votre compte de paiement.
          </p>
          <p style="color: #333; line-height: 1.7; font-size: 15px; margin: 0 0 24px;">
            La procédure est gérée par <strong>Stripe</strong>, le leader mondial du paiement en ligne (utilisé par Amazon, Deliveroo, Doctolib…). Vos données bancaires sont sécurisées et ne transitent jamais par Inspexo. Cela prend environ <strong>5 minutes</strong>.
          </p>

          <div style="background: #F8F9FA; border-radius: 12px; padding: 20px 24px; margin: 0 0 28px;">
            <p style="color: #0F1B2D; font-size: 14px; font-weight: 700; margin: 0 0 12px;">Ce que vous devrez fournir :</p>
            <p style="color: #374151; font-size: 14px; margin: 6px 0; line-height: 1.5;">✓ Vos informations personnelles (nom, adresse)</p>
            <p style="color: #374151; font-size: 14px; margin: 6px 0; line-height: 1.5;">✓ Votre IBAN pour les virements</p>
            <p style="color: #374151; font-size: 14px; margin: 6px 0; line-height: 1.5;">✓ Une pièce d'identité (vérification standard Stripe)</p>
          </div>

          <div style="text-align: center; margin: 32px 0;">
            <a href="${data.onboarding_url}" style="background: #FF4D00; color: #ffffff; padding: 16px 36px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 16px; display: inline-block;">
              Configurer mes versements →
            </a>
          </div>

          <p style="color: #9CA3AF; font-size: 13px; line-height: 1.6; text-align: center; margin: 0 0 8px;">
            Ce lien est personnel et à usage unique. Ne le partagez pas.
          </p>
          <p style="color: #9CA3AF; font-size: 13px; line-height: 1.6; text-align: center; margin: 0;">
            Une question ? Répondez à cet email ou écrivez à
            <a href="mailto:contact@inspexo.io" style="color: #FF4D00; text-decoration: none;"> contact@inspexo.io</a>
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

  nudge_no_analysis: (data) => ({
    subject: `Tu n'as pas encore analysé ton véhicule 🔍`,
    html: `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: #0F1B2D; padding: 32px; text-align: center;">
          <h1 style="color: #ffffff; font-size: 28px; margin: 0; letter-spacing: 3px;">INSPEXO</h1>
          <p style="color: rgba(255,255,255,0.6); margin: 8px 0 0; font-size: 14px;">Expert automobile à tes côtés</p>
        </div>
        <div style="padding: 32px;">
          <h2 style="color: #0F1B2D; font-size: 22px;">Tu envisages encore un achat ?</h2>
          <p style="color: #333; line-height: 1.6; font-size: 15px;">
            Tu t'es inscrit sur Inspexo mais tu n'as pas encore lancé d'analyse.
            ${data.vehicle ? `Tu regardes un <strong>${data.vehicle}</strong> ?` : 'Quel que soit le véhicule que tu vises,'}
            notre expert IA peut t'aider à éviter les mauvaises surprises.
          </p>
          <div style="background: #FFF0EA; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <p style="color: #0F1B2D; font-size: 14px; margin: 0 0 12px; font-weight: 700;">Ce que l'analyse gratuite te donne :</p>
            <p style="color: #333; font-size: 14px; margin: 6px 0; line-height: 1.5;">✓ Les défauts connus du modèle</p>
            <p style="color: #333; font-size: 14px; margin: 6px 0; line-height: 1.5;">✓ Les questions à poser au vendeur</p>
            <p style="color: #333; font-size: 14px; margin: 6px 0; line-height: 1.5;">✓ Les signaux d'alerte à surveiller</p>
            <p style="color: #FF4D00; font-size: 14px; margin: 6px 0; line-height: 1.5; font-weight: 600;">→ 10 échanges gratuits, sans CB</p>
          </div>
          <div style="text-align: center; margin: 32px 0;">
            <a href="https://inspexo.io" style="background: #FF4D00; color: #ffffff; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 16px; display: inline-block;">
              🔍 Lancer mon analyse gratuite
            </a>
          </div>
          <p style="color: #999; font-size: 13px; line-height: 1.5; text-align: center;">
            Il te reste <strong>${data.remaining_free ?? 3} analyse(s) gratuite(s)</strong> sur ton compte
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

  expert_new_mission: (data) => ({
    subject: `Nouvelle mission Inspexo — ${data.brand} ${data.model}`,
    html: `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: #0F1B2D; padding: 32px; text-align: center;">
          <h1 style="color: #ffffff; font-size: 28px; margin: 0; letter-spacing: 3px;">INSPEXO</h1>
          <p style="color: rgba(255,255,255,0.6); margin: 8px 0 0; font-size: 14px;">Espace Expert</p>
        </div>
        <div style="padding: 40px 32px;">
          <div style="text-align: center; font-size: 48px; margin-bottom: 16px;">🔔</div>
          <h2 style="color: #0F1B2D; font-size: 22px; text-align: center; margin: 0 0 8px;">
            Nouvelle mission assignée !
          </h2>
          <p style="color: #6B7280; font-size: 15px; text-align: center; margin: 0 0 32px;">
            Bonjour ${data.expert_name || ""},
          </p>
          <div style="background: #F8F9FA; border-radius: 12px; padding: 24px; margin: 0 0 28px;">
            <p style="margin: 8px 0; color: #374151; font-size: 14px;"><strong>Véhicule :</strong> ${data.vehicle || "—"}</p>
            <p style="margin: 8px 0; color: #374151; font-size: 14px;"><strong>Palier :</strong> ${data.tier || "—"}</p>
          </div>
          <p style="color: #333; line-height: 1.65; font-size: 15px; margin: 0 0 28px;">
            Un acheteur a réservé votre expertise. Connectez-vous à votre espace Inspexo pour voir les détails et convenir d'un créneau.
          </p>
          <div style="text-align: center; margin: 0 0 24px;">
            <a href="https://inspexo.io/dashboard" style="background: #FF4D00; color: #ffffff; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 16px; display: inline-block;">
              Voir la mission →
            </a>
          </div>
          <p style="color: #9CA3AF; font-size: 13px; text-align: center; line-height: 1.5; margin: 0;">
            Une question ? Écrivez à <a href="mailto:contact@inspexo.io" style="color: #FF4D00; text-decoration: none;">contact@inspexo.io</a>
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

  mission_assigned: (data) => ({
    subject: `Votre expert ${data.expert_name} est assigné — ${data.vehicle}`,
    html: `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: #0F1B2D; padding: 32px; text-align: center;">
          <h1 style="color: #ffffff; font-size: 28px; margin: 0; letter-spacing: 3px;">INSPEXO</h1>
          <p style="color: rgba(255,255,255,0.6); margin: 8px 0 0; font-size: 14px;">Expert automobile à vos côtés</p>
        </div>
        <div style="padding: 40px 32px;">
          <div style="text-align: center; font-size: 48px; margin-bottom: 16px;">✅</div>
          <h2 style="color: #0F1B2D; font-size: 22px; text-align: center; margin: 0 0 24px;">
            Bonne nouvelle — votre expert est assigné !
          </h2>
          <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 12px; padding: 20px 24px; margin: 0 0 28px;">
            <p style="margin: 0; color: #166534; font-size: 15px; font-weight: 600;">
              ${data.expert_name || "Un expert Inspexo"}, spécialiste ${data.brand || ""}, va s'occuper de votre ${data.vehicle || "véhicule"}.
            </p>
          </div>
          <p style="color: #333; line-height: 1.65; font-size: 15px; margin: 0 0 12px;">
            Prochaine étape : réservez votre créneau directement avec votre expert. Vous allez recevoir un lien de réservation.
          </p>
          <p style="color: #333; line-height: 1.65; font-size: 15px; margin: 0 0 28px;">
            Votre expert prendra contact avec vous dans les 24h pour convenir des modalités.
          </p>
          <div style="text-align: center; margin: 0 0 24px;">
            <a href="https://inspexo.io/dashboard" style="background: #FF4D00; color: #ffffff; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 16px; display: inline-block;">
              Voir ma mission →
            </a>
          </div>
          <p style="color: #9CA3AF; font-size: 13px; text-align: center; line-height: 1.5; margin: 0;">
            Une question ? Répondez à cet email ou écrivez à <a href="mailto:contact@inspexo.io" style="color: #FF4D00; text-decoration: none;">contact@inspexo.io</a>
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

  admin_no_expert: (data) => ({
    subject: `⚠️ Mission sans expert — ${data.brand} ${data.model}`,
    html: `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: #0F1B2D; padding: 32px; text-align: center;">
          <h1 style="color: #ffffff; font-size: 28px; margin: 0; letter-spacing: 3px;">INSPEXO</h1>
          <p style="color: rgba(255,255,255,0.6); margin: 8px 0 0; font-size: 14px;">Alerte Admin</p>
        </div>
        <div style="padding: 40px 32px;">
          <div style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: 12px; padding: 20px 24px; margin: 0 0 28px;">
            <p style="margin: 0; color: #991B1B; font-size: 15px; font-weight: 700;">
              ⚠️ Aucun expert disponible pour cette mission
            </p>
          </div>
          <div style="background: #F8F9FA; border-radius: 12px; padding: 20px 24px; margin: 0 0 28px;">
            <p style="margin: 8px 0; color: #374151; font-size: 14px;"><strong>ID mission :</strong> ${data.mission_id || "—"}</p>
            <p style="margin: 8px 0; color: #374151; font-size: 14px;"><strong>Véhicule :</strong> ${data.vehicle || "—"}</p>
            <p style="margin: 8px 0; color: #374151; font-size: 14px;"><strong>Palier :</strong> ${data.tier || "—"}</p>
            <p style="margin: 8px 0; color: #DC2626; font-size: 14px; font-weight: 600;"><strong>Marque sans expert :</strong> ${data.brand || "—"}</p>
          </div>
          <p style="color: #333; line-height: 1.65; font-size: 15px; margin: 0 0 16px;">
            Aucun expert avec <code>status = approved</code> et <code>stripe_account_id</code> configuré ne couvre la marque <strong>${data.brand}</strong>.
          </p>
          <p style="color: #333; line-height: 1.65; font-size: 15px; margin: 0 0 28px;">
            Action requise : assigner manuellement un expert depuis le dashboard admin, ou contacter le client pour l'informer du délai.
          </p>
          <div style="text-align: center;">
            <a href="https://inspexo.io/admin" style="background: #0F1B2D; color: #ffffff; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 16px; display: inline-block;">
              Ouvrir le dashboard admin →
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
