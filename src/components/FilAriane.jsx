import React from 'react'
import { Helmet } from 'react-helmet-async'

// SPRINT 24 (SEO) — fil d'Ariane en données structurées (BreadcrumbList).
// `items` : [{ nom, url }] du plus général au plus précis ; l'accueil est
// toujours le premier élément. Rien d'autre n'est déclaré : ni avis ni note.
const SITE = 'https://www.inspexo.io'

export default function FilAriane({ items = [] }) {
  const liste = [{ nom: 'Accueil', url: '/' }, ...items]
  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: liste.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.nom, item: `${SITE}${x.url}` })),
      })}</script>
    </Helmet>
  )
}
