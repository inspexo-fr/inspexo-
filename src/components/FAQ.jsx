import React, { useState } from 'react'


const faqs = [
  {
    q: 'Quelle différence entre un contrôle technique et une inspection Inspexo ?',
    a: 'Le contrôle technique vérifie la conformité réglementaire (freins, pollution, éclairage). L\'inspection Inspexo va bien au-delà : notre expert spécialisé examine l\'état réel du véhicule sur plus de 150 points, estime les frais à prévoir, et vous donne un verdict technique complet pour décider en connaissance de cause.',
  },
  {
    q: 'L\'inspection permet-elle de négocier le prix ?',
    a: 'Oui. Chaque défaut identifié par votre expert est chiffré avec une estimation de réparation. Vous disposez d\'arguments concrets pour négocier le prix avec le vendeur. Nos clients économisent en moyenne plusieurs centaines d\'euros grâce au rapport d\'inspection.',
  },
  {
    q: 'Pourquoi un expert spécialisé par marque ?',
    a: 'Un expert généraliste connaît les bases. Un expert spécialisé BMW, Mercedes ou Peugeot connaît les défauts récurrents de chaque motorisation, les rappels constructeur, les pièces qui lâchent à quel kilométrage. C\'est la différence entre un médecin généraliste et un spécialiste.',
  },
  {
    q: 'Que contient le rapport d\'inspection ?',
    a: 'Un diagnostic complet : état mécanique, carrosserie, intérieur, essai routier, vérification administrative. Chaque point est noté (conforme, à surveiller, défaut). Les défauts sont chiffrés avec deux estimations : garage indépendant et concession. Vous recevez aussi un verdict technique global.',
  },
  {
    q: 'L\'expert peut-il se déplacer sans moi ?',
    a: 'Pour l\'inspection physique, l\'expert se déplace sur le lieu du véhicule. Vous pouvez être présent ou non — dans les deux cas, vous recevez le rapport complet et pouvez échanger avec l\'expert via la messagerie Inspexo.',
  },
  {
    q: 'Comment fonctionne l\'analyse IA gratuite ?',
    a: 'Vous indiquez la marque, le modèle et l\'année du véhicule. Notre IA spécialisée vous expose les points de défaillance connus de cette motorisation exacte, les coûts de réparation associés, et les vérifications à faire. C\'est gratuit, 10 échanges, sans engagement.',
  },
  {
    q: 'Quelle est la différence entre Inspexo et les autres services d\'inspection ?',
    a: 'Trois différences majeures : nos experts sont spécialisés par marque (pas des généralistes), nous offrons une analyse IA gratuite en amont (personne d\'autre ne le fait), et notre visio test drive à 59€ est la solution la plus accessible du marché pour un premier avis expert.',
  },
  {
    q: 'Les experts sont-ils vraiment indépendants ?',
    a: 'Oui, totalement. Nos experts sont rémunérés exclusivement par l\'acheteur. Ils n\'ont aucune relation financière avec les vendeurs, garages ou concessionnaires. C\'est la garantie d\'un avis objectif.',
  },
  {
    q: 'Quelle est la différence entre la visio et l\'inspection physique ?',
    a: 'La visio permet de vérifier les documents, l\'état visuel général et les bruits moteur au démarrage — mais ne peut pas inspecter la mécanique sous capot, les suspensions, les freins, ou les zones repeintes. L\'inspection physique couvre tout cela via un déplacement de l\'expert chez le vendeur.',
  },
  {
    q: 'L\'analyse IA peut-elle remplacer un expert ?',
    a: 'Non. L\'analyse IA à 9,90€ est un outil de présélection qui identifie les défauts connus du modèle pour vous aider à décider si vous avez besoin d\'un expert sur place. Elle est conçue pour créer du recul, pas pour rassurer.',
  },
  {
    q: 'Comment sont qualifiés les experts Inspexo ?',
    a: 'Chaque expert passe par un processus de vérification de ses qualifications : expérience professionnelle documentée, spécialisation par marque confirmée. Nous utilisons le terme "qualifié" — jamais "certifié" — car il reflète une expertise vérifiée.',
  },
  {
    q: 'Comment fonctionne le paiement ?',
    a: 'Le paiement est sécurisé par Stripe. Votre carte est autorisée au moment de la réservation et débitée uniquement après confirmation de l\'expert. Les experts sont rémunérés via Stripe Connect. Aucun virement manuel n\'est jamais demandé.',
  },
  {
    q: 'Que se passe-t-il si l\'expert ne peut pas se déplacer ?',
    a: 'Si aucun expert n\'est disponible dans votre zone pour le palier Inspection Physique, vous êtes remboursé intégralement. La couverture actuelle est Toulouse & Haute-Garonne.',
  },
  {
    q: 'L\'expert négocie-t-il le prix pour moi ?',
    a: 'Non. L\'expert produit un rapport chiffré documentant les défauts et réparations à prévoir. Ce rapport vous appartient et vous pouvez l\'utiliser comme base de négociation avec le vendeur. L\'expert ne négocie pas à votre place.',
  },
]

export default function FAQ({ onFreeAnalysis }) {
  const [open, setOpen] = useState(null)

  return (
    <>
      <style>{`
        .faq-item { border-bottom: 1px solid rgba(0,0,0,0.07); }
        @media (max-width: 768px) {
          .faq-layout { grid-template-columns: 1fr !important; gap: 40px !important; }
          .faq-sidebar { position: static !important; }
          .faq-section { padding: 64px 20px !important; }
        }
        .faq-question {
          display: flex; justify-content: space-between; align-items: center;
          padding: 22px 0; cursor: pointer; gap: 16;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 1rem; font-weight: 600; color: #0F1B2D;
          transition: color 0.15s;
        }
        .faq-question:hover { color: #FF4D00; }
        .faq-chevron {
          width: 28px; height: 28px; border-radius: '50%';
          background: #F0F2F5; display: flex; align-items: center; justify-content: center;
          font-size: 1.25rem; color: #FF4D00; font-weight: 400;
          transition: transform 0.25s; flex-shrink: 0; border-radius: 50%;
        }
        .faq-answer {
          padding: 0 0 22px 0;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 0.9375rem; font-weight: 300;
          color: #4B5563; line-height: 1.7;
        }
      `}</style>

      <section id="faq" className="faq-section" style={{ background: '#fff', padding: '96px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>

          <div className="faq-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 72, alignItems: 'start' }}>

            {/* Left */}
            <div className="faq-sidebar" style={{ position: 'sticky', top: 100 }}>
              <div style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '0.8125rem', fontWeight: 600,
                color: '#FF4D00', letterSpacing: '0.12em',
                textTransform: 'uppercase', marginBottom: 20,
              }}>
                {'// 05 — FAQ'}
              </div>
              <h2 style={{
                fontFamily: 'Syne, sans-serif', fontWeight: 800,
                fontSize: 'clamp(1.75rem, 3vw, 2.25rem)',
                color: '#0F1B2D', lineHeight: 1.1, marginBottom: 20,
              }}>
                Questions fréquentes
              </h2>
              <p style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '0.9375rem', fontWeight: 300,
                color: '#6B7280', lineHeight: 1.65, marginBottom: 32,
              }}>
                Tout ce que vous devez savoir avant de réserver.
              </p>
              <a href="mailto:contact@inspexo.io" style={{
                display: 'inline-block',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '0.875rem', fontWeight: 600,
                color: '#FF4D00', textDecoration: 'none',
                borderBottom: '1px solid rgba(255,77,0,0.3)',
                paddingBottom: 2, transition: 'border-color 0.2s',
              }}>
                Autre question ? Écrivez-nous →
              </a>
            </div>

            {/* Right — accordion */}
            <div>
              {faqs.map((faq, i) => (
                <div key={i} className="faq-item">
                  <div
                    className="faq-question"
                    onClick={() => setOpen(open === i ? null : i)}
                  >
                    <span>{faq.q}</span>
                    <div className="faq-chevron" style={{
                      transform: open === i ? 'rotate(45deg)' : 'rotate(0deg)',
                    }}>
                      +
                    </div>
                  </div>
                  {open === i && (
                    <div className="faq-answer">{faq.a}</div>
                  )}
                </div>
              ))}

              {/* CTA après la FAQ */}
              <div style={{
                marginTop: 32, padding: '24px',
                background: '#FFF0EA', borderRadius: 14,
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
              }}>
                <div style={{
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize: '0.9375rem', fontWeight: 500,
                  color: '#374151', lineHeight: 1.55,
                }}>
                  Encore des doutes ?<br />
                  <span style={{ color: '#FF4D00', fontWeight: 700 }}>
                    Lance une analyse gratuite
                  </span>{' '}— notre expert IA répond à tes questions.
                </div>
                <button
                  onClick={onFreeAnalysis}
                  style={{
                    background: '#FF4D00', color: '#fff',
                    border: 'none', borderRadius: 10,
                    padding: '11px 24px', cursor: 'pointer',
                    fontFamily: 'Syne, sans-serif', fontWeight: 700,
                    fontSize: '0.9rem', whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  🔍 Analyser gratuitement
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
