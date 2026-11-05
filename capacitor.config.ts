import type { CapacitorConfig } from '@capacitor/cli'

// Appli mobile « Partager → Inspexo » (sprint 4B, test de faisabilité — rien
// n'est publié). Elle embarque le build React existant tel quel ; la réception
// du partage et la lecture de l'annonce se font sur le téléphone (WebView),
// jamais depuis nos serveurs.
const config: CapacitorConfig = {
  appId: 'io.inspexo.app',
  appName: 'Inspexo',
  webDir: 'build',
}

export default config
