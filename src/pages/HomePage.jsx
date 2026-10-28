import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import AnalyseForm from '../components/AnalyseForm'
import PhotoSlot from '../components/PhotoSlot'
import Rows from '../components/Rows'
import DossierApercu from '../components/DossierApercu'
import EmailCapture from '../components/EmailCapture'

// Accueil — reproduction de docs/design/maquette-v1.html (référence absolue).
// Structure et textes mot pour mot ; le formulaire du hero est le VRAI
// formulaire de /score (même composant) ; « Un dossier réel » lit la vraie
// analyse S7 depuis la base.
export default function HomePage() {
  return (
    <>
      <Helmet>
        <title>Inspexo — L'annonce dit ce que le vendeur veut. On lit le reste.</title>
        <meta name="description" content="Collez une annonce Leboncoin, La Centrale ou AutoScout24. En une minute : rappels constructeur, airbags Takata, pannes connues du moteur, statut réel du vendeur, questions à lui poser. Chaque affirmation renvoie à sa source." />
        <link rel="canonical" href="https://www.inspexo.io/" />
      </Helmet>

      <Navbar />

      <main id="top">
        {/* HERO */}
        <section className="hero" id="analyser">
          <div className="wrap hero-grid">
            <div>
              <p className="eyebrow">Voitures d'occasion · 100 % côté acheteur</p>
              <h1>L'annonce dit ce que le vendeur veut. On lit le reste.</h1>
              <p className="lead">
                Collez une annonce Leboncoin, La Centrale ou AutoScout24. En une minute :
                rappels constructeur, airbags Takata, pannes connues du moteur, statut réel
                du vendeur, questions à lui poser. Chaque affirmation renvoie à sa source.
              </p>
              <div className="hero-facts">
                <div><span>Prix</span><span>Gratuit, sans inscription</span></div>
                <div><span>Durée</span><span>Environ 1 minute</span></div>
                <div><span>Sources</span><span>Affichées, une par une</span></div>
                <div><span>Lien avec les vendeurs</span><span>Aucun</span></div>
              </div>
            </div>
            <AnalyseForm idPrefix="hero" />
          </div>
        </section>

        {/* PHOTOS */}
        <section className="strip" aria-label="Photographies">
          <div className="wrap">
            <div className="frames">
              <figure className="frame">
                <PhotoSlot src="carnet.jpg" legende="Photo à venir · shooting atelier" alt="Carnet d'entretien tamponné" />
                <figcaption><span>01</span><span><b>Le carnet d'entretien, pas la brochure.</b> Tampons, factures, dates : ce qu'on vous apprend à lire avant de payer.</span></figcaption>
              </figure>
              <figure className="frame">
                <PhotoSlot src="compteur.jpg" legende="Photo à venir" alt="Compteur kilométrique, contact mis" />
                <figcaption><span>02</span><span><b>Le compteur, contact mis.</b> Le kilométrage lu est comparé à celui de l'annonce.</span></figcaption>
              </figure>
              <figure className="frame">
                <PhotoSlot src="controle-technique.jpg" legende="Photo à venir" alt="Procès-verbal de contrôle technique" />
                <figcaption><span>03</span><span><b>Le PV de contrôle technique.</b> Chaque défaut relevé, relié aux pannes connues du moteur.</span></figcaption>
              </figure>
            </div>
          </div>
        </section>

        {/* CE QU'ON VÉRIFIE */}
        <section className="sec" id="verifie">
          <div className="wrap">
            <div className="sec-head">
              <h2>Ce qu'on vérifie, et où on va le chercher.</h2>
              <p>Pas d'avis général sur le modèle. Des points précis, chacun rattaché à une base officielle, à un document constructeur ou au texte même de l'annonce.</p>
            </div>
            <Rows items={[
              { dt: 'Rappels constructeur', titre: 'Les campagnes qui concernent ce véhicule, avec leur code.', texte: 'RappelConso, la base de l\'État, plus les campagnes constructeur documentées (NHTSA, Transports Canada) quand la France n\'a pas de fiche. Un rappel d\'une autre génération ou d\'une autre motorisation n\'apparaît pas.' },
              { dt: 'Airbags Takata', titre: 'Le modèle est-il sur la liste officielle du ministère ?', texte: 'Vérifié à chaque analyse, affiché même quand la réponse est non. Environ 1,3 million de véhicules sous consigne de ne plus rouler circulent encore, selon le ministère des Transports.' },
              { dt: 'Pannes du moteur', titre: 'Les défaillances connues de cette famille moteur, pas d\'une autre.', texte: 'Une fiche par moteur, construite à partir de sources nommées. Les programmes de prise en charge aussi : sur un 1.2 PureTech, l\'extension Stellantis à 10 ans ou 175 000 km et les trois dernières factures qu\'elle exige.' },
              { dt: 'Le vendeur', titre: 'Particulier, professionnel ou intermédiaire : ce que ça change pour vos garanties.', texte: 'Une agence qui vend « pour un particulier » peut légalement écarter la garantie de conformité. Pas si elle est propriétaire du véhicule. On vous dit quoi demander.' },
              { dt: 'L\'annonce elle-même', titre: 'Ce qu\'elle dit, ce qu\'elle cache, ce qu\'elle contredit.', texte: 'Double prix, frais de mise en main obligatoires, distribution « d\'origine » à 160 000 km, boîte annoncée qui n\'existe pas sur ce moteur.' },
              { dt: 'Les photos', titre: 'Compteur, pneus, carrosserie, PV de contrôle technique.', texte: 'Le kilométrage lu au compteur est comparé à celui de l\'annonce. Les photos sont analysées puis oubliées : rien n\'est conservé.' },
            ]} />
          </div>
        </section>

        {/* DOSSIER RÉEL */}
        <section className="sec" id="dossier">
          <div className="wrap">
            <div className="sec-head">
              <h2>Un dossier réel, tel que vous le recevez.</h2>
              <p>Annonce publiée à Toulouse en octobre 2026. Les faits ont été vérifiés à la main avant publication ; les références renvoient aux documents d'origine.</p>
            </div>
            <div className="dossier-grid">
              <DossierApercu />
              <aside className="notes" aria-label="Comment lire ce dossier">
                <div className="note"><p className="eyebrow">Le tampon</p><p><strong>Trois couleurs, pas de nuances molles.</strong> Vert : rien de bloquant dans l'annonce. Orange : à vérifier avant d'avancer. Rouge : un danger, une casse probable, un rappel non traité ou un vendeur qui écarte vos droits.</p></div>
                <div className="note"><p className="eyebrow">Les critères</p><p><strong>Un score que vous pouvez recalculer.</strong> Cinq critères notés sur 20 par des règles fixes. Quand une information manque, le critère est « non évalué » et sort du total : le silence d'une annonce ne fait jamais baisser la note.</p></div>
                <div className="note"><p className="eyebrow">Les motifs</p><p><strong>Propres à cette voiture.</strong> Jamais de phrase valable pour toutes les annonces. Chaque motif dit quoi demander au vendeur, et chaque chiffre renvoie à une note de bas de page.</p></div>
                <div className="note"><p className="eyebrow">Ce qui n'y est pas</p><p><strong>Les affirmations écartées sont comptées.</strong> Une seconde lecture relit chaque phrase contre l'annonce et les sources. Ce qui ne tient pas est retiré, et vous voyez combien.</p></div>
              </aside>
            </div>
          </div>
        </section>

        {/* COMMENT ÇA MARCHE */}
        <section className="sec" id="methode">
          <div className="wrap">
            <div className="sec-head">
              <h2>De l'annonce à la poignée de main.</h2>
              <p>Quatre temps. Les deux premiers sont gratuits. Les deux suivants arrivent avec le Pass achat.</p>
            </div>
            <div className="steps-grid">
              <div>
                <div className="steps">
                  <div className="step"><span className="n">1</span><div><h3>Collez l'annonce</h3><p>Le texte, et si vous voulez les photos. Depuis l'ordinateur, le bouton de l'extension le fait pour vous.</p><span className="tag">Gratuit</span></div></div>
                  <div className="step"><span className="n">2</span><div><h3>Lisez le dossier</h3><p>Verdict, motifs, contrôles officiels, message au vendeur prêt à envoyer. Une minute après.</p><span className="tag">Gratuit</span></div></div>
                  <div className="step"><span className="n">3</span><div><h3>Visitez, guidé</h3><p>Devant la voiture, point par point : démarrage à froid, compteur, pneus, PV de contrôle technique. Vos photos mettent le verdict à jour.</p><span className="tag">Pass achat</span></div></div>
                  <div className="step"><span className="n">4</span><div><h3>Négociez, chiffré</h3><p>Chaque défaut constaté et chaque entretien en retard devient un montant sourcé, avec l'argumentaire à dire au vendeur.</p><span className="tag">Pass achat</span></div></div>
                </div>
              </div>
              <div>
                <div className="phone" role="img" aria-label="Écran du mode visite : point Compteur kilométrique, réponses Oui, Doute, Non">
                  <div className="phone-bar"><span>← DOSSIER</span><span>VISITE · 1/15</span></div>
                  <div className="phone-sub"><span>Audi S7 Sportback 2015</span><b>PRUDENCE · 44/100</b></div>
                  <div className="phone-body">
                    <div className="pbar"><i></i></div>
                    <h4>Compteur kilométrique</h4>
                    <p className="how">Contact mis, photographiez le compteur. Le kilométrage lu est comparé à celui de l'annonce.</p>
                    <p className="red">Signal rouge : kilométrage différent de celui annoncé.</p>
                    <div className="shoot">PHOTOGRAPHIER · ANALYSÉ SUR PLACE</div>
                    <div className="tri"><span className="y">Oui</span><span className="d">Doute</span><span className="n">Non</span></div>
                    <p className="live"><b>Verdict mis à jour après chaque réponse.</b> À la fin : acheter, négocier ou ne pas acheter, avec les points qui ont pesé.</p>
                  </div>
                </div>
                <p className="phone-cap">Le mode visite, devant la voiture. Quinze points dans l'ordre d'une vraie inspection, démarrage à froid en premier.</p>
              </div>
            </div>
          </div>
        </section>

        {/* RÈGLE */}
        <section className="band" id="regle">
          <div className="wrap">
            <p className="eyebrow">Notre règle</p>
            <h2>Ce qui n'est pas prouvé n'apparaît pas.</h2>
            <p className="lead">Un outil qui invente une panne vous fait rater une bonne voiture. Un outil qui en oublie une vous en fait acheter une mauvaise. On préfère écrire moins, et que tout tienne.</p>
            <div className="proofs">
              <div className="proof"><div className="k">1 <small>SOURCE PAR AFFIRMATION</small></div><p>Panne, rappel, coût, point de droit : chaque ligne renvoie à un document que vous pouvez ouvrir.</p></div>
              <div className="proof"><div className="k">2 <small>LECTURES</small></div><p>Une première écrit le dossier. Une seconde le relit contre l'annonce et les sources, et retire ce qui ne tient pas. Le compte des retraits est affiché.</p></div>
              <div className="proof"><div className="k">0 <small>CHIFFRE INVENTÉ</small></div><p>Pas de « juste prix » sans assez d'annonces comparables. Pas de coût de réparation sans source. On écrit « non évalué » plutôt qu'un nombre.</p></div>
            </div>
            <p style={{ marginTop: 28 }}><Link to="/fiabilite">Notre taux d'erreur sera publié dès 50 dossiers relus à la main.</Link></p>
          </div>
        </section>

        {/* PASS */}
        <section className="sec" id="pass">
          <div className="wrap">
            <div className="sec-head">
              <h2>Le Pass achat : jusqu'à la signature.</h2>
              <p>Le vendeur ne nous paie jamais. Quand l'achat devient sérieux, c'est vous qui décidez de payer, une fois, pour trente jours.</p>
            </div>
            <PlansPass />
          </div>
        </section>

        {/* CANAUX */}
        <section className="sec" id="canaux">
          <div className="wrap">
            <div className="sec-head">
              <h2>Là où vous cherchez déjà.</h2>
              <p>L'analyse vient à vous. Rien à copier sur ordinateur, un geste sur téléphone.</p>
            </div>
            <div className="channels">
              <div className="channel">
                <h3>Sur le site</h3>
                <p>Collez le texte de l'annonce, ajoutez les photos si vous voulez. Marche partout, sans rien installer.</p>
                <ol><li><span>1</span>Copiez l'annonce</li><li><span>2</span>Collez-la ci-dessus</li><li><span>3</span>Lisez le dossier</li></ol>
                <span className="state">Disponible</span>
              </div>
              <div className="channel">
                <h3>Extension Chrome</h3>
                <p>Un bouton « Analyser avec Inspexo » sur chaque annonce Leboncoin, La Centrale et AutoScout24. Texte et photos partent tout seuls.</p>
                <ol><li><span>1</span>Installez l'extension</li><li><span>2</span>Ouvrez une annonce</li><li><span>3</span>Appuyez sur le bouton</li></ol>
                <span className="state">Bientôt sur le Chrome Web Store</span>
              </div>
              <div className="channel">
                <h3>Appli iPhone et Android</h3>
                <p>Depuis l'appli Leboncoin, touchez Partager puis Inspexo. L'annonce est lue sur votre téléphone, jamais par nos serveurs.</p>
                <ol><li><span>1</span>Ouvrez l'annonce dans Leboncoin</li><li><span>2</span>Partager, puis Inspexo</li><li><span>3</span>Le dossier s'ouvre</li></ol>
                <span className="state">En préparation</span>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="sec" id="faq">
          <div className="wrap faq-grid">
            <div className="sec-head" style={{ marginBottom: 24 }}><h2>Questions franches.</h2></div>
            <div className="faq">
              <details><summary>C'est vraiment gratuit ? Où est le piège ?<span className="pm" aria-hidden="true">+</span></summary><div className="a">L'analyse d'annonce est gratuite, cinq par jour, sans compte. Elle nous coûte quelques centimes et nous sert à être connus. Le Pass achat, payant, finance le reste. Nous ne vendons aucune donnée et nous n'avons aucun accord avec des vendeurs, des garages ou des assureurs qui influencerait un verdict.</div></details>
              <details><summary>D'où viennent les pannes que vous citez ?<span className="pm" aria-hidden="true">+</span></summary><div className="a">D'une fiche par famille moteur, construite à partir de sources nommées : documents de rappel, presse automobile spécialisée, forums techniques de la marque. Une source qui parle d'un autre moteur est rejetée. Les fiches les plus consultées sont relues par un mécanicien avant d'être marquées « base Inspexo ».</div></details>
              <details><summary>Pourquoi le prix est-il parfois « non évalué » ?<span className="pm" aria-hidden="true">+</span></summary><div className="a">Parce que nous refusons d'afficher un « juste prix » sorti de nulle part. Une fourchette n'apparaît qu'avec au moins quinze annonces comparables récentes, et elle est présentée comme des prix demandés, pas des prix de vente. Avec l'extension, les annonces que vous consultez servent de comparables.</div></details>
              <details><summary>Vous remplacez un expert sur place ?<span className="pm" aria-hidden="true">+</span></summary><div className="a">Non. Nous lisons l'annonce et les documents, et nous vous guidons pendant la visite. Nous ne montons pas sous la voiture. Pour un véhicule cher ou un doute sérieux, un contrôle sur pont reste la bonne décision ; nous préparons un réseau de garages et d'experts indépendants, sur liste d'attente.</div></details>
              <details><summary>Que faites-vous de mes photos et de l'annonce ?<span className="pm" aria-hidden="true">+</span></summary><div className="a">Les photos sont analysées puis supprimées immédiatement, elles ne sont jamais stockées. Le texte de l'annonce est conservé avec le dossier pour que vous puissiez le rouvrir et le partager. Les prix et kilométrages alimentent des statistiques agrégées par modèle, jamais republiées annonce par annonce.</div></details>
              <details><summary>Et le taux d'erreur ?<span className="pm" aria-hidden="true">+</span></summary><div className="a">Des dossiers sont tirés au hasard et relus phrase par phrase par un humain. Chaque affirmation est marquée juste, fausse ou discutable. Les taux seront publiés dès cinquante dossiers relus, par type d'affirmation, et mis à jour automatiquement ensuite.</div></details>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}

// Les deux plans du Pass achat — CTA gratuit vers le formulaire, CTA Pass =
// capteur « Être prévenu » (pass_waitlist), seule action orange de l'écran.
export function PlansPass({ analysisId = null }) {
  const [capture, setCapture] = useState(false)
  return (
    <div className="plans">
      <div className="plan">
        <div className="plan-head"><span className="name">Analyse</span><span className="price">GRATUIT</span></div>
        <ul>
          <li><span className="m">—</span>Verdict, score par critère, motifs</li>
          <li><span className="m">—</span>Rappels constructeur et airbags Takata</li>
          <li><span className="m">—</span>Pannes connues du moteur, sourcées</li>
          <li><span className="m">—</span>Statut du vendeur et vos garanties</li>
          <li><span className="m">—</span>Message au vendeur et liste de contrôle</li>
          <li><span className="m">—</span>Jusqu'à 5 analyses par jour</li>
        </ul>
        <div className="plan-foot"><Link className="btn-ghost" to="/score">Analyser une annonce</Link></div>
      </div>
      <div className="plan pass">
        <div className="plan-head">
          <span className="name">Pass achat</span>
          <span className="price">29 € · 30 JOURS<br />ANNONCES ILLIMITÉES</span>
        </div>
        <ul>
          <li><span className="m">+</span>Tout ce que contient l'analyse gratuite, sans limite</li>
          <li><span className="m">+</span>Visite guidée devant la voiture, point par point, photos analysées sur place</li>
          <li><span className="m">+</span>Marge de négociation détaillée, chaque montant sourcé, argumentaire prêt à dire</li>
          <li><span className="m">+</span>Lecture de votre PV de contrôle technique, défaut par défaut</li>
          <li><span className="m">+</span>Décodage du numéro de châssis : moteur exact, équipements réels</li>
          <li><span className="m">+</span>Dossier d'achat : vos pistes, alertes rappel et prix, suivi jusqu'à l'achat</li>
          <li><span className="m">+</span>Kit signature : contrat de cession, documents à exiger, démarches</li>
        </ul>
        <div className="plan-foot">
          {capture ? (
            <EmailCapture
              title="Le Pass achat arrive — être prévenu du lancement ?"
              buttonLabel="Être prévenu"
              source="pass_waitlist"
              analysisId={analysisId}
            />
          ) : (
            <button type="button" className="btn" onClick={() => setCapture(true)}>Être prévenu du lancement</button>
          )}
          <p className="pass-note">Sortie prévue en décembre 2026. Remboursé sans condition pendant 14 jours. Aucune reconduction automatique.</p>
        </div>
      </div>
    </div>
  )
}
