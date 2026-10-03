import './legacy-redirect';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './App';
import { migrateLegacyVerbs } from './data/legacy-migration';
import { scheduleSync, startAutoSync } from './data/sync';
import { lockZoomWhenInstalled } from './pwa';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Élément #root introuvable dans index.html');

// Les verbes de Verbheft, repris une seule fois depuis l'ancien stockage,
// puis un échange peu après le démarrage.
void migrateLegacyVerbs()
  .catch((error: unknown) => console.error('[reprise Verbheft]', error))
  .finally(() => scheduleSync(1500));

// Puis à chaque retour dans l'app, au retour du réseau et après chaque
// modification locale.
startAutoSync();

// Lancée depuis l'écran d'accueil, l'app ne se pince plus pour zoomer.
lockZoomWhenInstalled();

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
