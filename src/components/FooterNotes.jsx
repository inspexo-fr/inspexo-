import React from 'react'

export default function FooterNotes() {
  return (
    <div style={{ background: '#080E18', padding: '20px 24px 28px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {[
          '* Vérification de l\'identité du véhicule (VIN, carte grise) effectuée lors de la Visio Test Drive. Aucune garantie légale sur la conformité administrative.',
          '** Le rapport de négociation est une estimation chiffrée des défauts et des frais de remise en état. Il ne constitue pas une garantie contractuelle sur le prix de vente.',
          '*** Les avis et notes affichés correspondent à des missions réalisées en phase de lancement. La notation vérifiée sera activée dès les premières missions publiques.',
        ].map((note, i) => (
          <p key={i} style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: '0.6875rem', fontWeight: 300,
            color: 'rgba(255,255,255,0.22)',
            lineHeight: 1.6, marginBottom: i < 2 ? 4 : 0,
          }}>
            {note}
          </p>
        ))}
      </div>
    </div>
  )
}
