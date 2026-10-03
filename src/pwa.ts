/**
 * Installation et mise à jour du service worker.
 *
 * Le service worker ne tourne qu'en production : en développement, Vite sert
 * les fichiers à la volée et un cache ne ferait que masquer les
 * modifications. Il exige aussi une origine sécurisée — HTTPS, ou localhost.
 * Ouvrir l'app par l'adresse réseau du Mac (http://192.168.x.x) ne
 * l'activera donc pas.
 */

let reloading = false;

export function registerServiceWorker(onUpdateReady: () => void): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  const start = (): void => {
    void navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Une version déjà installée attend peut-être depuis la visite
        // précédente.
        if (registration.waiting && navigator.serviceWorker.controller) onUpdateReady();

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          installing?.addEventListener('statechange', () => {
            // `controller` absent = première installation : il n'y a rien à
            // remplacer, donc rien à proposer.
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              onUpdateReady();
            }
          });
        });
      })
      .catch(() => undefined);
  };

  /*
   * On attend la fin du chargement pour ne pas disputer la bande passante au
   * premier rendu — mais React monte ce composant *après* l'événement `load`,
   * si bien qu'un simple écouteur ne serait jamais appelé. D'où la
   * vérification de l'état du document.
   */
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}

/** Demande à la version en attente de prendre la main, puis recharge. */
export function applyUpdate(): void {
  void navigator.serviceWorker.getRegistration().then((registration) => {
    registration?.waiting?.postMessage('SKIP_WAITING');
  });
}

/* ------------------------------------------------------------------ */
/* Comportement d'application installée                                */
/* ------------------------------------------------------------------ */

/** Lancée depuis l'écran d'accueil, par opposition à un onglet de navigateur. */
function isInstalled(): boolean {
  // `navigator.standalone` est la version iOS, antérieure au media query.
  const legacy = (navigator as { standalone?: boolean }).standalone === true;
  return legacy || window.matchMedia('(display-mode: standalone)').matches;
}

/**
 * Supprime le zoom quand l'app tourne depuis l'écran d'accueil.
 *
 * Une app installée ne se pince pas pour zoomer : le geste n'y a pas de sens
 * et donne l'impression d'une page web déguisée. Dans un onglet de
 * navigateur, en revanche, le zoom reste disponible — c'est le contexte où
 * l'on s'attend à pouvoir agrandir, et le retirer serait un recul
 * d'accessibilité pour qui en a besoin.
 *
 * Trois choses à neutraliser, car aucune ne couvre les autres :
 *
 * 1. Le `viewport`, que l'on ne peut pas écrire en dur dans `index.html`
 *    puisqu'il ne doit s'appliquer qu'à l'app installée.
 * 2. Le pincement, que seul WebKit signale par les événements `gesture*`.
 * 3. La double frappe, couverte par `touch-action` dans la feuille de style.
 */
export function lockZoomWhenInstalled(): () => void {
  if (!isInstalled()) return () => undefined;

  const viewport = document.querySelector('meta[name="viewport"]');
  const original = viewport?.getAttribute('content') ?? '';
  viewport?.setAttribute('content', `${original}, maximum-scale=1, user-scalable=no`);

  const block = (event: Event): void => event.preventDefault();
  // Propres à WebKit, et absents ailleurs : les ajouter est sans effet sur
  // les navigateurs qui ne les émettent pas.
  for (const nom of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(nom, block, { passive: false });
  }

  return () => {
    if (viewport && original) viewport.setAttribute('content', original);
    for (const nom of ['gesturestart', 'gesturechange', 'gestureend']) {
      document.removeEventListener(nom, block);
    }
  };
}
