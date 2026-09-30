import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

/** Génère sw.js avec la liste des fichiers du build à mettre en cache. */
function serviceWorker(): Plugin {
  const publicFiles = [
    './',
    'manifest.webmanifest',
    'icons/icon.svg',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/apple-touch-icon.png',
  ];
  return {
    name: 'verbheft-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle)
        .filter((f) => !f.endsWith('.map') && f !== 'index.html')
        .sort();
      const version = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 12);
      const source = readFileSync(new URL('./sw/sw.template.js', import.meta.url), 'utf8')
        .replace('__VERSION__', version)
        .replace('__PRECACHE__', JSON.stringify([...publicFiles, ...files], null, 2));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  // Chemins relatifs : l'app fonctionne quel que soit le sous-dossier
  // (ex. https://<utilisateur>.github.io/Languages/).
  base: './',
  build: {
    // Le dictionnaire (~5 Mo) reste un fichier séparé, jamais inliné.
    assetsInlineLimit: 0,
  },
  plugins: [serviceWorker()],
});
