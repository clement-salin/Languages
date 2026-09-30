import './style.css';
import { loadLexicon } from './lexicon';
import { STORAGE_KEY, VerbStore } from './storage';
import { h } from './ui/dom';
import { renderListView, type AppContext } from './ui/listView';
import { currentRoute } from './ui/router';
import { renderVerbView } from './ui/verbView';

const app = document.getElementById('app')!;

async function start(): Promise<void> {
  app.replaceChildren(h('p', { class: 'loading' }, 'Chargement du dictionnaire…'));
  let ctx: AppContext;
  try {
    ctx = { store: new VerbStore(), lexicon: await loadLexicon() };
  } catch (error) {
    app.replaceChildren(
      h('section', { class: 'card' },
        h('h1', {}, 'Oups'),
        h('p', {}, 'Le dictionnaire n’a pas pu être chargé. Vérifie ta connexion puis recharge la page.'),
        h('p', { class: 'hint' }, String(error)),
        h('button', { class: 'btn btn-primary', onclick: () => location.reload() }, 'Recharger'),
      ),
    );
    return;
  }

  const render = () => {
    const route = currentRoute();
    if (route.name === 'verb') {
      renderVerbView(app, ctx, route.id);
    } else {
      document.title = 'Verbheft · mes verbes allemands';
      renderListView(app, ctx);
    }
    window.scrollTo(0, 0);
  };
  window.addEventListener('hashchange', render);
  // Carnet modifié dans un autre onglet : on se remet à jour.
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    ctx.store.reload();
    render();
  });
  render();
}

void start();

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Hors ligne indisponible : l'application fonctionne quand même en ligne.
    });
  });
}
