import React, { useState } from 'react';

function App() {
  const [selectedMarque, setSelectedMarque] = useState('Toutes');
  const [notifEmail, setNotifEmail] = useState('');
  const [notifSent, setNotifSent] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const categorieMarques = [
    {
      label: '🚗 Généralistes',
      marques: ['Renault','Peugeot','Citroën','Volkswagen','Toyota','Dacia','Ford','Opel','Nissan','Hyundai','Kia','Fiat','Skoda','Seat','Mazda','Subaru','Mitsubishi','Honda','Mini','Jeep']
    },
    {
      label: '💎 Premium & Sportives',
      marques: ['BMW','Mercedes','Audi','Volvo','Land Rover','Jaguar','Lexus','Genesis','Cadillac','Tesla','Porsche','Maserati','Ferrari','Lamborghini','Alfa Romeo','Lotus','Aston Martin','McLaren','Bentley','Rolls-Royce','Dodge','Chevrolet']
    },
  ];

  const experts = [
    { nom: 'Thomas R.', marque: 'BMW', specialite: 'Série 3, M3 — moteurs N52 et S55', exp: '12 ans', missions: 847, note: '4.9' },
    { nom: 'Marc D.', marque: 'Mercedes', specialite: 'Classe C, E — moteurs OM651 et M276', exp: '9 ans', missions: 634, note: '4.8' },
    { nom: 'Sophie L.', marque: 'Porsche', specialite: '911, Cayenne — moteurs MA1 et M48', exp: '7 ans', missions: 312, note: '5.0' },
    { nom: 'Kevin M.', marque: 'Audi', specialite: 'A4, RS4 — moteurs CDNC et CGWB', exp: '11 ans', missions: 521, note: '4.9' },
    { nom: 'Laura M.', marque: 'Ferrari', specialite: '488, F8 — moteurs V8 biturbo', exp: '8 ans', missions: 89, note: '5.0' },
    { nom: 'Pierre V.', marque: 'Land Rover', specialite: 'Defender, Discovery — châssis 4x4', exp: '14 ans', missions: 198, note: '5.0' },
    { nom: 'Nicolas F.', marque: 'Volkswagen', specialite: 'Golf, Passat — boîtes DSG et moteurs TSI', exp: '10 ans', missions: 398, note: '4.9' },
    { nom: 'Antoine B.', marque: 'Renault', specialite: 'Mégane, Clio — moteurs K9K et H4M', exp: '8 ans', missions: 445, note: '4.8' },
    { nom: 'Sarah C.', marque: 'Maserati', specialite: 'Ghibli, Quattroporte — V6 biturbo', exp: '9 ans', missions: 112, note: '4.8' },
    { nom: 'Paul T.', marque: 'Alfa Romeo', specialite: 'Giulia, Stelvio — moteurs GME', exp: '11 ans', missions: 203, note: '4.9' },
  ];

  const faqs = [
    { q: "L'expert est-il vraiment indépendant du vendeur ?", r: "Oui, totalement. Nos experts sont rémunérés exclusivement par vous, l'acheteur. Ils n'ont aucun intérêt à valider une mauvaise voiture — leur réputation sur Inspexo en dépend." },
    { q: "Que se passe-t-il si le vendeur refuse l'inspection ?", r: "Un vendeur qui refuse une inspection a généralement quelque chose à cacher. Nos experts vous conseillent sur la marche à suivre — et dans la plupart des cas, ce refus est déjà une réponse." },
    { q: "Combien de temps avant ma visite dois-je réserver ?", r: "Idéalement 24h à l'avance. Pour les visios, nous pouvons parfois nous organiser en quelques heures selon la disponibilité de l'expert." },
    { q: "L'expert peut-il inspecter une voiture chez un concessionnaire ?", r: "Oui. Nos experts interviennent chez les particuliers comme chez les professionnels. Les concessionnaires sérieux n'ont aucune raison de refuser." },
    { q: "Êtes-vous disponibles le week-end ?", r: "Oui. La plupart des visites de voitures se font le week-end — nos experts sont disponibles le samedi et dimanche sur réservation." },
  ];

  const expertsFiltres = experts.filter(e =>
    selectedMarque === 'Toutes' || e.marque === selectedMarque
  );

  const C = {
    orange: '#FF4D00',
    orangeLight: '#FF6B35',
    orangePale: '#FFF0EA',
    bleuNuit: '#0F1B2D',
    bleuMid: '#1A2E45',
    bleuAccent: '#1E4D8C',
    blanc: '#FFFFFF',
    gris1: '#F8F9FA',
    gris2: '#F0F2F5',
    texte: '#0F1B2D',
    muted: '#6B7280',
    bordure: 'rgba(0,0,0,0.07)',
  };

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", margin: 0, padding: 0, background: C.blanc, color: C.texte, overflowX: 'hidden' }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300;1,400&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { -webkit-font-smoothing: antialiased; }
        .nav-a:hover { color: white !important; }
        .btn-orange:hover { background: #E64400 !important; }
        .btn-dark:hover { background: ${C.orange} !important; }
        .card-btn-white:hover { background: ${C.gris2} !important; }
        .expert-btn:hover { background: ${C.orange} !important; color: white !important; }
        .pill { padding: 6px 14px; border-radius: 100px; font-size: 12px; font-weight: 500; cursor: pointer; background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.45); border: 1px solid rgba(255,255,255,0.08); font-family: 'Plus Jakarta Sans', sans-serif; transition: all 0.2s; }
        .pill:hover { background: rgba(255,255,255,0.12); color: white; }
        .pill.active { background: ${C.orange}; color: white; border-color: ${C.orange}; }
        .card-hover { transition: transform 0.2s, box-shadow 0.2s; }
        .card-hover:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(0,0,0,0.1) !important; }
        .footer-a:hover { color: rgba(255,255,255,0.7) !important; }
        @media (max-width: 767px) {
          .nav-links-d { display: none !important; }
          .nav-cta-d { display: none !important; }
          .hamburger { display: flex !important; }
          .hero-h1 { font-size: 44px !important; letter-spacing: -1.5px !important; }
          .hero-btns { flex-direction: column !important; }
          .hero-btns button { width: 100% !important; }
          .stats-bar { grid-template-columns: 1fr 1fr !important; }
          .cards-grid { grid-template-columns: 1fr !important; }
          .steps-grid { grid-template-columns: 1fr !important; }
          .experts-grid { grid-template-columns: 1fr 1fr !important; }
          .revenus-grid { grid-template-columns: repeat(3, 1fr) !important; }
          .footer-grid { grid-template-columns: 1fr 1fr !important; }
          .notif-row { flex-direction: column !important; }
          .notif-row input { width: 100% !important; }
          .section-pad { padding: 64px 20px !important; }
        }
        @media (min-width: 1024px) {
          .hero-h1 { font-size: 80px !important; letter-spacing: -3px !important; }
          .cards-grid { grid-template-columns: repeat(3, 1fr) !important; }
          .steps-grid { grid-template-columns: repeat(3, 1fr) !important; }
          .experts-grid { grid-template-columns: repeat(4, 1fr) !important; }
          .stats-bar { grid-template-columns: repeat(4, 1fr) !important; }
        }
      `}</style>

      {/* ── NAVBAR ── */}
      <nav style={{ background: C.bleuNuit, padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000 }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, letterSpacing: 3, color: 'white' }}>
          INSP<span style={{ color: C.orange }}>EXO</span>
        </div>
        <div className="nav-links-d" style={{ display: 'flex', gap: 32 }}>
          {[['Comment ça marche','comment'],['Nos services','services'],['Nos experts','experts'],['Devenir expert','devenir']].map(([l,id]) => (
            <a key={id} href={`#${id}`} className="nav-a" style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontSize: 14, fontWeight: 400 }}>{l}</a>
          ))}
        </div>
        <button className="nav-cta-d btn-orange" style={{ background: C.orange, color: 'white', border: 'none', padding: '10px 24px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 600, cursor: 'pointer', borderRadius: 6 }}>
          Trouver mon expert
        </button>
        <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}
          style={{ display: 'none', flexDirection: 'column', gap: 5, cursor: 'pointer', padding: 4, background: 'none', border: 'none' }}>
          <span style={{ display: 'block', width: 22, height: 2, background: 'white', transition: 'all 0.3s', transform: menuOpen ? 'translateY(7px) rotate(45deg)' : 'none' }}></span>
          <span style={{ display: 'block', width: 22, height: 2, background: 'white', transition: 'all 0.3s', opacity: menuOpen ? 0 : 1 }}></span>
          <span style={{ display: 'block', width: 22, height: 2, background: 'white', transition: 'all 0.3s', transform: menuOpen ? 'translateY(-7px) rotate(-45deg)' : 'none' }}></span>
        </button>
      </nav>

      {/* ── MENU MOBILE ── */}
      {menuOpen && (
        <div style={{ position: 'fixed', top: 64, left: 0, right: 0, bottom: 0, background: C.bleuNuit, zIndex: 999, display: 'flex', flexDirection: 'column', padding: '40px 24px', gap: 8, overflowY: 'auto' }}>
          {[['Comment ça marche','comment'],['Nos services','services'],['Nos experts','experts'],['Devenir expert','devenir']].map(([l,id]) => (
            <a key={id} href={`#${id}`} onClick={() => setMenuOpen(false)}
              style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 700, color: 'white', textDecoration: 'none', padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{l}</a>
          ))}
          <button className="btn-orange" onClick={() => setMenuOpen(false)} style={{ marginTop: 24, background: C.orange, color: 'white', border: 'none', padding: 18, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, fontWeight: 700, cursor: 'pointer', borderRadius: 8 }}>
            Trouver mon expert →
          </button>
        </div>
      )}

      {/* ── HERO ── */}
      <section style={{ background: C.bleuNuit, padding: '120px 24px 80px', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -100, left: '50%', transform: 'translateX(-50%)', width: 600, height: 400, background: 'radial-gradient(ellipse, rgba(255,77,0,0.18) 0%, transparent 70%)', pointerEvents: 'none' }}></div>
        <div style={{ position: 'absolute', bottom: -80, right: -60, width: 300, height: 300, borderRadius: '50%', border: '1px solid rgba(255,77,0,0.08)', pointerEvents: 'none' }}></div>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,77,0,0.12)', border: '1px solid rgba(255,77,0,0.25)', borderRadius: 100, padding: '7px 16px', fontSize: 12, fontWeight: 600, color: 'rgba(255,130,80,0.95)', marginBottom: 36, position: 'relative' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.orange, display: 'inline-block', flexShrink: 0 }}></span>
          Un expert par marque — votre seul allié face au vendeur
        </div>

        <h1 className="hero-h1" style={{ fontFamily: "'Syne', sans-serif", fontSize: 68, fontWeight: 800, lineHeight: 0.95, letterSpacing: -2, color: 'white', marginBottom: 28, position: 'relative', maxWidth: 800 }}>
          Achetez<br />
          <span style={{ color: 'transparent', WebkitTextStroke: '2px rgba(255,255,255,0.25)' }}>votre véhicule</span><br />
          <span style={{ color: C.orange }}>sans surprise.</span>
        </h1>

        <p style={{ fontSize: 17, lineHeight: 1.85, color: 'rgba(255,255,255,0.5)', fontWeight: 300, maxWidth: 560, marginBottom: 40, position: 'relative' }}>
          Votre BMW mérite un expert BMW. Votre Porsche mérite un expert Porsche.{' '}
          <em style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 500, fontStyle: 'italic' }}>Un passionné qui connaît sur le bout des doigts chaque faiblesse, chaque défaut, chaque maladie</em>{' '}
          que peut cacher votre future voiture — avant même que vous la voyez.
        </p>

        <div className="hero-btns" style={{ display: 'flex', gap: 12, marginBottom: 28, justifyContent: 'center', position: 'relative' }}>
          <button className="btn-orange" onClick={() => document.getElementById('services').scrollIntoView({ behavior: 'smooth' })}
            style={{ background: C.orange, color: 'white', border: 'none', padding: '17px 40px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15, fontWeight: 700, cursor: 'pointer', borderRadius: 8 }}>
            Trouver mon expert →
          </button>
          <button onClick={() => document.getElementById('comment').scrollIntoView({ behavior: 'smooth' })}
            style={{ background: 'transparent', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)', padding: '17px 40px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15, fontWeight: 400, cursor: 'pointer', borderRadius: 8 }}>
            Comment ça marche
          </button>
        </div>

        <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap', position: 'relative' }}>
          {['🔒 Paiement sécurisé', '✅ Experts qualifiés', '💯 Mission garantie *'].map((b, i) => (
            <span key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>{b}</span>
          ))}
        </div>
      </section>

      {/* ── STATS BAR — fond orange ── */}
      <div className="stats-bar" style={{ background: C.orange, display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        {[['5,5M','Transactions VO / an'],['30+','Marques couvertes'],['12€','Pour commencer'],['100%','Côté acheteur']].map(([num, label], i) => (
          <div key={i} style={{ padding: '28px 32px', borderRight: i % 2 === 0 ? '1px solid rgba(255,255,255,0.15)' : 'none', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.15)' : 'none', textAlign: 'center' }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 34, fontWeight: 800, color: 'white', letterSpacing: -1, lineHeight: 1 }}>{num}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 4, fontWeight: 500, letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── COMMENT CA MARCHE ── */}
      <section id="comment" className="section-pad" style={{ padding: '100px 24px', background: C.blanc, textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: C.orange, marginBottom: 16 }}>// 01 — Comment ça marche</div>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 44, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.05, color: C.texte, marginBottom: 16 }}>Simple, rapide,<br />sans engagement</h2>
        <p style={{ fontSize: 16, color: C.muted, fontWeight: 300, lineHeight: 1.75, maxWidth: 520, margin: '0 auto 64px' }}>De la première question jusqu'à la signature — un expert qualifié vous accompagne à chaque étape.</p>

        <div className="steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 40, maxWidth: 900, margin: '0 auto' }}>
          {[
            { icon: '🎯', num: 'Étape 01', titre: 'Je choisis ma marque et mon palier', desc: "Je sélectionne la marque de la voiture qui m'intéresse et le niveau d'accompagnement dont j'ai besoin — de 12€ à 250€." },
            { icon: '⚡', num: 'Étape 02', titre: 'Mis en relation en moins de 2h *', desc: "Un expert qualifié sur ma marque exacte me contacte et organise la session selon mon calendrier." },
            { icon: '✅', num: 'Étape 03', titre: "J'achète en confiance", desc: "Avec le compte-rendu de mon expert en main, je sais exactement à quoi m'en tenir avant de signer." },
          ].map((step, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: C.orangePale, border: '2px solid rgba(255,77,0,0.15)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{step.icon}</div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: C.orange, marginBottom: 8 }}>{step.num}</div>
              <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 700, color: C.texte, marginBottom: 10, letterSpacing: -0.3 }}>{step.titre}</h3>
              <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.75, fontWeight: 300 }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section id="services" className="section-pad" style={{ padding: '100px 24px', background: C.gris1, textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: C.orange, marginBottom: 16 }}>// 02 — Nos services</div>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 44, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.05, color: C.texte, marginBottom: 16 }}>Quel que soit votre budget,<br />vous n'achetez plus seul</h2>
        <p style={{ fontSize: 16, color: C.muted, fontWeight: 300, lineHeight: 1.75, maxWidth: 520, margin: '0 auto 56px' }}>Un expert qualifié à vos côtés, de la première question jusqu'à la signature</p>

        <div className="cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, maxWidth: 1100, margin: '0 auto' }}>
          {[
            {
              badge: 'Éclairez votre décision', emoji: '💬',
              nom: 'IA Spécialisée', prix: '12€',
              period: 'Votre expert IA disponible 48h', featured: false,
              items: ["Entraînée sur votre marque spécifique","Défauts et maladies fréquents du modèle","Script de questions au vendeur","Estimation du juste prix marché","Signaux d'alerte à ne pas manquer","Rapport détaillé après session"]
            },
            {
              badge: '⭐ Recommandé', emoji: '📹',
              nom: 'Visio Test Drive', prix: '75€',
              period: "L'expert dans votre poche", featured: true,
              items: ["Expert qualifié sur votre marque","Connaissance des défauts chroniques","En direct pendant votre visite","Guidage pendant votre essai routier","Vérification identité véhicule *","Historique administratif","Avis et recommandations du spécialiste","Compte-rendu détaillé sous 24h"]
            },
            {
              badge: 'Rien au hasard', emoji: '🔧',
              nom: 'Inspection Physique', prix: '250€',
              period: 'Votre expert sur place', featured: false,
              items: ["Spécialiste qualifié de votre marque","Connaissance des défauts chroniques","Inspection compartiment moteur","Essai statique et routier complet","Vérification identité — frappe à froid *","Détection des zones repeintes","Analyse du contrôle technique","Rapport photo complet sous 24h","Avis et recommandations du spécialiste"]
            }
          ].map((card, i) => (
            <div key={i} className="card-hover" style={{ background: card.featured ? C.bleuNuit : C.blanc, border: `1px solid ${card.featured ? C.bleuNuit : C.bordure}`, borderRadius: 12, padding: 36, textAlign: 'left', boxShadow: card.featured ? '0 8px 40px rgba(15,27,45,0.2)' : '0 2px 12px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: card.featured ? 'white' : C.muted, background: card.featured ? C.orange : C.gris2, padding: '4px 12px', borderRadius: 100 }}>{card.badge}</div>
                <span style={{ fontSize: 28 }}>{card.emoji}</span>
              </div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, letterSpacing: -0.5, marginBottom: 4, color: card.featured ? 'white' : C.texte }}>{card.nom}</div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 52, fontWeight: 800, letterSpacing: -2, lineHeight: 1, margin: '12px 0 4px', color: card.featured ? 'white' : C.texte }}>{card.prix}</div>
              <div style={{ fontSize: 13, color: card.featured ? 'rgba(255,255,255,0.4)' : C.muted, marginBottom: 24, fontWeight: 300 }}>{card.period}</div>
              <div style={{ height: 1, background: card.featured ? 'rgba(255,255,255,0.08)' : C.bordure, marginBottom: 20 }}></div>
              <ul style={{ listStyle: 'none', marginBottom: 28, flex: 1 }}>
                {card.items.map((item, j) => (
                  <li key={j} style={{ fontSize: 14, color: card.featured ? 'rgba(255,255,255,0.6)' : C.muted, padding: '8px 0', borderBottom: `1px solid ${card.featured ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}`, display: 'flex', gap: 10, alignItems: 'flex-start', lineHeight: 1.5 }}>
                    <span style={{ color: C.orange, fontWeight: 700, flexShrink: 0 }}>+</span>{item}
                  </li>
                ))}
              </ul>
              <button className={card.featured ? 'btn-orange' : 'card-btn-white'} style={{ width: '100%', padding: 15, background: card.featured ? C.orange : C.gris2, color: card.featured ? 'white' : C.texte, border: 'none', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 700, cursor: 'pointer', borderRadius: 8 }}>
                {i === 0 ? 'Commencer →' : 'Réserver →'}
              </button>
            </div>
          ))}
        </div>

        <div style={{ background: C.orangePale, borderLeft: `3px solid ${C.orange}`, padding: '18px 24px', marginTop: 20, display: 'flex', gap: 12, alignItems: 'flex-start', borderRadius: '0 8px 8px 0', maxWidth: 1100, margin: '20px auto 0', textAlign: 'left' }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>🛡️</span>
          <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.75, fontWeight: 300 }}>
            <strong style={{ color: C.texte, fontWeight: 600 }}>Votre mission est garantie. *</strong>{' '}
            Si un défaut mécanique grave est constaté par un professionnel et absent de notre rapport — nous vous remboursons intégralement le prix de votre mission.
          </p>
        </div>
      </section>

      {/* ── EXPERTS ── */}
      <section id="experts" className="section-pad" style={{ padding: '100px 24px', background: C.bleuNuit, color: 'white', textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,100,50,0.9)', marginBottom: 16 }}>// 03 — Nos experts</div>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 44, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.05, color: 'white', marginBottom: 16 }}>Un expert dédié<br />à votre marque</h2>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', fontWeight: 300, lineHeight: 1.8, maxWidth: 560, margin: '0 auto 16px', fontStyle: 'italic' }}>
          Un passionné qui connaît sur le bout des doigts chaque faiblesse, chaque défaut, chaque maladie que peut cacher votre future voiture — avant même que vous la voyez.
        </p>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,77,0,0.1)', border: '1px solid rgba(255,77,0,0.2)', padding: '7px 16px', borderRadius: 100, fontSize: 12, color: 'rgba(255,120,60,0.9)', marginBottom: 44, fontWeight: 500 }}>
          📍 Toulouse & Haute-Garonne — D'autres villes arrivent bientôt
        </div>

        {categorieMarques.map((cat, ci) => (
          <div key={ci} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', marginBottom: 10 }}>{cat.label}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {cat.marques.map(m => (
                <button key={m} onClick={() => setSelectedMarque(m)} className={`pill${selectedMarque === m ? ' active' : ''}`}>{m}</button>
              ))}
            </div>
          </div>
        ))}
        <div style={{ marginBottom: 44, marginTop: 8 }}>
          <button onClick={() => setSelectedMarque('Toutes')} className={`pill${selectedMarque === 'Toutes' ? ' active' : ''}`}>Toutes les marques</button>
        </div>

        <div className="experts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, maxWidth: 1000, margin: '0 auto 44px' }}>
          {expertsFiltres.length === 0 ? (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 16 }}>🔍</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15, fontWeight: 300, lineHeight: 1.8 }}>
                Aucun expert disponible pour cette marque à Toulouse pour l'instant.<br />
                <span style={{ fontSize: 13 }}>Notre réseau s'agrandit chaque semaine.</span>
              </div>
            </div>
          ) : expertsFiltres.map((e, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 20, textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: `linear-gradient(135deg, ${C.bleuAccent}, ${C.orange})`, margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: 'white' }}>{e.nom.charAt(0)}</div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{e.nom}</div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: C.orange, background: 'rgba(255,77,0,0.1)', padding: '3px 10px', borderRadius: 100, display: 'inline-block', marginBottom: 10 }}>Spécialiste {e.marque}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', lineHeight: 1.5, fontStyle: 'italic', marginBottom: 10 }}>{e.specialite}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', marginBottom: 3 }}>⏱ {e.exp} d'expérience</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', marginBottom: 6 }}>✅ {e.missions} missions</div>
              <div style={{ fontSize: 12, color: '#F59E0B', marginBottom: 4 }}>⭐ {e.note}/5</div>
              <div style={{ fontSize: 10, color: '#F59E0B', fontWeight: 600, marginBottom: 14 }}>🏆 Expert Qualifié Inspexo</div>
              <button className="expert-btn" style={{ width: '100%', padding: 10, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.65)', border: 'none', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: 6 }}>
                Réserver cet expert →
              </button>
            </div>
          ))}
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 32, maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', lineHeight: 1.75, marginBottom: 20, fontWeight: 300 }}>
            Vous n'êtes pas à Toulouse ? Laissez votre email — on vous prévient dès qu'un expert est disponible dans votre ville.
          </p>
          {notifSent ? (
            <div style={{ color: C.orange, fontWeight: 600, fontSize: 15 }}>✅ Parfait, on vous tient informé !</div>
          ) : (
            <div className="notif-row" style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <input type="email" placeholder="votre@email.com" value={notifEmail} onChange={e => setNotifEmail(e.target.value)}
                style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'white', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, outline: 'none', width: 260 }} />
              <button className="btn-orange" onClick={() => { if (notifEmail) { setNotifSent(true); setNotifEmail(''); } }}
                style={{ padding: '14px 24px', background: C.orange, color: 'white', border: 'none', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 700, cursor: 'pointer', borderRadius: 8, whiteSpace: 'nowrap' }}>
                Me notifier
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── DEVENIR EXPERT ── */}
      <section id="devenir" className="section-pad" style={{ padding: '100px 24px', background: C.orangePale, textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: C.orange, marginBottom: 16 }}>// 04 — Rejoindre le réseau</div>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 44, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.05, color: C.texte, marginBottom: 16 }}>Vous êtes passionné<br />par une marque ?</h2>
        <p style={{ fontSize: 16, color: C.muted, lineHeight: 1.85, fontWeight: 300, maxWidth: 520, margin: '0 auto 44px' }}>
          Rejoignez Inspexo en tant qu'expert qualifié. Gagnez de l'argent en faisant ce que vous faites déjà par passion. Votre profil valorise votre expertise et vous connecte à des acheteurs sérieux dans votre région.
        </p>
        <div className="revenus-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: 'rgba(255,77,0,0.1)', border: '1px solid rgba(255,77,0,0.1)', borderRadius: 10, overflow: 'hidden', maxWidth: 600, margin: '0 auto 36px' }}>
          {[['50€','par visio (1h)'],['175€','par inspection'],['300€','inspection + accompagnement']].map(([val,label],i) => (
            <div key={i} style={{ background: C.blanc, padding: '28px 16px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 800, color: C.orange, letterSpacing: -1 }}>{val}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 6, lineHeight: 1.4 }}>{label}</div>
            </div>
          ))}
        </div>
        <button className="btn-dark" style={{ background: C.bleuNuit, color: 'white', border: 'none', padding: '18px 48px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15, fontWeight: 700, cursor: 'pointer', borderRadius: 8 }}>
          Rejoindre le réseau Inspexo →
        </button>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="section-pad" style={{ padding: '100px 24px', background: C.blanc, textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: C.orange, marginBottom: 16 }}>// 05 — Questions fréquentes</div>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 44, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.05, color: C.texte, marginBottom: 48 }}>Tout ce que vous voulez<br />savoir avant de vous lancer</h2>
        <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'left' }}>
          {faqs.map((faq, i) => (
            <div key={i} style={{ borderBottom: `1px solid ${C.bordure}` }}>
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{ width: '100%', padding: '20px 0', background: 'none', border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', gap: 16, textAlign: 'left' }}>
                <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 600, color: C.texte, letterSpacing: -0.3, lineHeight: 1.4 }}>{faq.q}</span>
                <span style={{ fontSize: 22, color: C.orange, flexShrink: 0, display: 'inline-block', transform: openFaq === i ? 'rotate(45deg)' : 'none', transition: 'transform 0.3s' }}>+</span>
              </button>
              {openFaq === i && (
                <div style={{ paddingBottom: 20, fontSize: 14, color: C.muted, lineHeight: 1.85, fontWeight: 300 }}>{faq.r}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: C.bleuNuit, padding: '60px 24px 36px' }}>
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, letterSpacing: 3, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>
            INSP<span style={{ color: C.orange, opacity: 0.7 }}>EXO</span>
          </div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)', fontWeight: 300, lineHeight: 1.6 }}>L'expert de votre côté — pour acheter votre véhicule en toute confiance.</p>
        </div>
        <div className="footer-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32, marginBottom: 40, paddingBottom: 40, borderBottom: '1px solid rgba(255,255,255,0.05)', maxWidth: 700, margin: '0 auto 40px' }}>
          {[
            { title: 'Navigation', links: ['Comment ça marche','Nos services','Nos experts','Devenir expert','FAQ'] },
            { title: 'Contact', links: ['contact@inspexo.io','Toulouse, France'] },
            { title: 'Légal', links: ['CGU','Politique de confidentialité','Mentions légales'] },
          ].map((col, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', marginBottom: 16 }}>{col.title}</div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {col.links.map((l, j) => (
                  <li key={j}><a href="#" className="footer-a" style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', textDecoration: 'none', fontWeight: 300 }}>{l}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, alignItems: 'center', maxWidth: 700, margin: '0 auto', paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.15)' }}>© 2025 Inspexo — Tous droits réservés</div>
          <div style={{ display: 'flex', gap: 20 }}>
            {['CGU','Confidentialité','Mentions légales'].map((l,i) => (
              <a key={i} href="#" className="footer-a" style={{ fontSize: 12, color: 'rgba(255,255,255,0.15)', textDecoration: 'none' }}>{l}</a>
            ))}
          </div>
        </div>
      </footer>

      {/* ── NOTES ── */}
      <div style={{ padding: '20px 24px', background: '#080E18', borderTop: '1px solid rgba(255,255,255,0.03)', textAlign: 'center' }}>
        {[
          '* Votre mission est garantie sous conditions. Voir CGU pour les détails complets.',
          '* Vérification visuelle des numéros de série. Ne constitue pas une expertise judiciaire.',
          '* Délai indicatif selon disponibilité des experts dans votre zone géographique.',
        ].map((note, i) => (
          <div key={i} style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)', lineHeight: 1.7, marginBottom: 3, fontWeight: 300 }}>{note}</div>
        ))}
      </div>

    </div>
  );
}

export default App;