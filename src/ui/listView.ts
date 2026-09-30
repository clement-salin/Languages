import { VERB_CLASS_LABELS, type Conjugation } from '../core/verb';
import type { Lexicon } from '../lexicon';
import type { SavedVerb, VerbStore } from '../storage';
import { parseImport, toCsv, toJson } from '../transfer';
import { debounce, download, h, toast } from './dom';
import { verbHref } from './router';

export interface AppContext {
  store: VerbStore;
  lexicon: Lexicon;
}

type SortOrder = 'recent' | 'oldest' | 'alpha';
type Filter = 'all' | 'strong' | 'weak' | 'irregular' | 'sein' | 'prefix';

const FILTERS: [Filter, string][] = [
  ['all', 'Tous'],
  ['strong', 'Forts'],
  ['weak', 'Faibles'],
  ['irregular', 'Irréguliers'],
  ['sein', 'Avec sein'],
  ['prefix', 'À particule'],
];

// État de la liste conservé entre deux affichages.
const listState = { query: '', sort: 'recent' as SortOrder, filter: 'all' as Filter };

export function renderListView(root: HTMLElement, ctx: AppContext): void {
  const { store, lexicon } = ctx;
  root.replaceChildren(
    addForm(ctx),
    h('section', { class: 'notebook', 'aria-labelledby': 'notebook-title' },
      h('div', { class: 'notebook-head' },
        h('h2', { id: 'notebook-title' }, 'Mon carnet'),
        h('p', { class: 'stats', id: 'stats' }),
      ),
      toolbar(),
      h('ul', { class: 'verb-list', id: 'verb-list' }),
    ),
    footer(ctx),
  );
  refreshList();

  function toolbar(): HTMLElement {
    const search = h('input', {
      type: 'search',
      class: 'input',
      placeholder: 'Rechercher un verbe ou une traduction',
      'aria-label': 'Rechercher dans le carnet',
      value: listState.query,
      oninput: debounce(() => {
        listState.query = search.value;
        refreshList();
      }, 120),
    });
    const sort = h('select', {
      class: 'input select',
      'aria-label': 'Trier',
      onchange: () => {
        listState.sort = sort.value as SortOrder;
        refreshList();
      },
    },
      h('option', { value: 'recent' }, 'Plus récents'),
      h('option', { value: 'oldest' }, 'Plus anciens'),
      h('option', { value: 'alpha' }, 'A → Z'),
    );
    sort.value = listState.sort;
    const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Filtrer' },
      FILTERS.map(([value, label]) =>
        h('button', {
          type: 'button',
          class: 'chip',
          'aria-pressed': String(listState.filter === value),
          onclick: (e: Event) => {
            listState.filter = value;
            for (const c of chips.querySelectorAll('.chip')) c.setAttribute('aria-pressed', 'false');
            (e.currentTarget as HTMLElement).setAttribute('aria-pressed', 'true');
            refreshList();
          },
        }, label),
      ),
    );
    return h('div', { class: 'toolbar' }, h('div', { class: 'toolbar-row' }, search, sort), chips);
  }

  function refreshList(): void {
    const list = root.querySelector('#verb-list');
    const stats = root.querySelector('#stats');
    if (!list || !stats) return;
    const all = store.all();
    const rows = all
      .map((verb) => ({ verb, conj: lexicon.conjugateSaved(verb) }))
      .filter(({ verb, conj }) => matches(verb, conj));
    sortRows(rows);

    const today = new Date().toDateString();
    const addedToday = all.filter((v) => new Date(v.addedAt).toDateString() === today).length;
    stats.textContent = all.length === 0
      ? ''
      : `${plural(all.length, 'verbe')}${addedToday ? ` · ${addedToday} aujourd'hui` : ''}`;

    if (all.length === 0) {
      list.replaceChildren(h('li', { class: 'empty' },
        h('p', {}, 'Ton carnet est vide.'),
        h('p', {}, 'Ajoute ci-dessus le premier verbe de ta leçon du jour !'),
      ));
      return;
    }
    if (rows.length === 0) {
      list.replaceChildren(h('li', { class: 'empty' }, 'Aucun verbe ne correspond.'));
      return;
    }
    list.replaceChildren(...rows.map(({ verb, conj }) => verbRow(verb, conj)));
  }

  function matches(verb: SavedVerb, conj: Conjugation | null): boolean {
    const q = fold(listState.query.trim());
    if (q && !fold(verb.id).includes(q) && !fold(verb.translation).includes(q)) return false;
    switch (listState.filter) {
      case 'all': return true;
      case 'strong': return conj?.verbClass === 'strong';
      case 'weak': return conj?.verbClass === 'weak';
      case 'irregular': return !!conj && ['mixed', 'modal', 'irregular'].includes(conj.verbClass);
      case 'sein': return conj?.auxiliary === 'sein';
      case 'prefix': return !!conj?.verb.prefix && conj.separable;
    }
  }

  function sortRows(rows: { verb: SavedVerb }[]): void {
    const byDate = (a: { verb: SavedVerb }, b: { verb: SavedVerb }) => b.verb.addedAt.localeCompare(a.verb.addedAt);
    if (listState.sort === 'recent') rows.sort(byDate);
    if (listState.sort === 'oldest') rows.sort((a, b) => byDate(b, a));
    if (listState.sort === 'alpha') {
      const key = (v: SavedVerb) => v.id.replace(/^sich /, '');
      rows.sort((a, b) => key(a.verb).localeCompare(key(b.verb), 'de'));
    }
  }
}

function verbRow(verb: SavedVerb, conj: Conjugation | null): HTMLElement {
  const parts = conj?.principalParts;
  return h('li', {},
    h('a', { class: 'verb-row', href: verbHref(verb.id) },
      h('div', { class: 'verb-row-main' },
        h('span', { class: 'verb-inf', lang: 'de' }, verb.id),
        verb.translation && h('span', { class: 'verb-translation' }, verb.translation),
      ),
      h('div', { class: 'verb-row-sub', lang: 'de' },
        parts ? `${parts.present3} · ${parts.preterite3} · ${parts.perfect3}` : 'verbe non reconnu',
      ),
      conj && h('span', { class: `badge badge-${conj.verbClass}` }, VERB_CLASS_LABELS[conj.verbClass]),
    ),
  );
}

/* ------------------------------------------------------------------------ */
/* Formulaire d'ajout avec autocomplétion                                  */
/* ------------------------------------------------------------------------ */

function addForm(ctx: AppContext): HTMLElement {
  const { store, lexicon } = ctx;
  let active = -1;
  let options: string[] = [];

  const listbox = h('ul', { class: 'suggestions', id: 'verb-suggestions', role: 'listbox', hidden: true });
  const verbInput = h('input', {
    id: 'verb-input',
    class: 'input input-lg',
    type: 'text',
    lang: 'de',
    placeholder: 'fahren, sich freuen, anrufen…',
    autocomplete: 'off',
    autocapitalize: 'none',
    spellcheck: 'false',
    enterkeyhint: 'next',
    role: 'combobox',
    'aria-autocomplete': 'list',
    'aria-expanded': 'false',
    'aria-controls': 'verb-suggestions',
    oninput: () => {
      message.replaceChildren();
      options = verbInput.value.trim() ? lexicon.index.complete(verbInput.value) : [];
      active = -1;
      renderSuggestions();
    },
    onkeydown: (e: Event) => {
      const key = (e as KeyboardEvent).key;
      if (listbox.hidden) return;
      if (key === 'ArrowDown' || key === 'ArrowUp') {
        e.preventDefault();
        const step = key === 'ArrowDown' ? 1 : -1;
        active = (active + step + options.length) % options.length;
        renderSuggestions();
      } else if (key === 'Enter' && active >= 0) {
        e.preventDefault();
        choose(options[active]);
      } else if (key === 'Escape') {
        closeSuggestions();
      }
    },
    onblur: () => setTimeout(closeSuggestions, 150),
  });
  const translationInput = h('input', {
    id: 'translation-input',
    class: 'input',
    type: 'text',
    placeholder: 'Traduction (facultatif) : conduire, aller en voiture…',
    autocomplete: 'off',
    enterkeyhint: 'done',
  });
  const message = h('div', { class: 'form-message', 'aria-live': 'polite' });

  function renderSuggestions(): void {
    if (options.length === 0) {
      closeSuggestions();
      return;
    }
    listbox.replaceChildren(...options.map((option, i) =>
      h('li', {
        id: `suggestion-${i}`,
        role: 'option',
        class: 'suggestion',
        lang: 'de',
        'aria-selected': String(i === active),
        onmousedown: (e: Event) => {
          e.preventDefault();
          choose(option);
        },
      }, option),
    ));
    listbox.hidden = false;
    verbInput.setAttribute('aria-expanded', 'true');
    if (active >= 0) verbInput.setAttribute('aria-activedescendant', `suggestion-${active}`);
    else verbInput.removeAttribute('aria-activedescendant');
  }

  function closeSuggestions(): void {
    listbox.hidden = true;
    verbInput.setAttribute('aria-expanded', 'false');
    verbInput.removeAttribute('aria-activedescendant');
  }

  function choose(option: string): void {
    verbInput.value = option;
    options = [];
    closeSuggestions();
    translationInput.focus();
  }

  function submit(e: Event): void {
    e.preventDefault();
    closeSuggestions();
    const raw = verbInput.value.trim();
    if (!raw) {
      verbInput.focus();
      return;
    }
    const result = lexicon.lookup(raw);
    if (!result.ok) {
      const word = raw.split(/\s+/).pop() ?? raw;
      const close = lexicon.index.closest(word);
      message.replaceChildren(h('div', {},
        h('p', { class: 'error' }, `« ${raw} » n'est pas dans le dictionnaire.`),
        close.length > 0 && h('p', {}, 'Vouliez-vous dire : ',
          ...close.flatMap((c, i) => [
            i > 0 ? ', ' : '',
            h('button', { type: 'button', class: 'link', lang: 'de', onclick: () => {
              verbInput.value = raw.replace(new RegExp(`${escapeRegExp(word)}$`), c);
              message.replaceChildren();
              verbInput.focus();
            } }, c),
          ]),
          ' ?'),
      ));
      return;
    }
    const { verb } = result;
    const id = verb.reflexive ? `sich ${verb.infinitive}` : verb.infinitive;
    if (store.has(id)) {
      toast(`« ${id} » est déjà dans ton carnet.`);
    } else {
      store.add({ id, translation: translationInput.value.trim() });
      toast(`« ${id} » ajouté !`);
    }
    location.hash = verbHref(id);
  }

  return h('section', { class: 'card add-card', 'aria-labelledby': 'add-title' },
    h('h2', { id: 'add-title' }, 'Ajouter un verbe'),
    h('form', { class: 'add-form', onsubmit: submit, autocomplete: 'off' },
      h('div', { class: 'combobox' },
        h('label', { for: 'verb-input', class: 'visually-hidden' }, 'Infinitif en allemand'),
        verbInput,
        listbox,
      ),
      h('label', { for: 'translation-input', class: 'visually-hidden' }, 'Traduction en français'),
      translationInput,
      h('button', { type: 'submit', class: 'btn btn-primary' }, 'Ajouter'),
    ),
    message,
  );
}

/** Identifiant canonique d'un verbe saisi (« an rufen » → « anrufen »). */
function idFor(ctx: AppContext, raw: string): string {
  const result = ctx.lexicon.lookup(raw);
  if (!result.ok) return raw.trim();
  const { verb } = result;
  return verb.reflexive ? `sich ${verb.infinitive}` : verb.infinitive;
}

/* ------------------------------------------------------------------------ */
/* Pied de page : export / import                                           */
/* ------------------------------------------------------------------------ */

function footer(ctx: AppContext): HTMLElement {
  const { store, lexicon } = ctx;
  const fileInput = h('input', {
    type: 'file',
    accept: '.json,.csv,.txt,application/json,text/csv,text/plain',
    class: 'visually-hidden',
    onchange: async () => {
      const file = fileInput.files?.[0];
      fileInput.value = '';
      if (!file) return;
      try {
        importFile(await file.text());
      } catch {
        toast('Fichier illisible : choisis un export JSON ou un CSV.');
      }
    },
  });

  function importFile(text: string): void {
    let added = 0;
    let existing = 0;
    const unknown: string[] = [];
    for (const entry of parseImport(text)) {
      if (!lexicon.lookup(entry.input).ok) {
        unknown.push(entry.input);
        continue;
      }
      const id = idFor(ctx, entry.input);
      const current = store.get(id);
      if (current) {
        existing++;
        if (!current.translation && entry.translation) store.update(id, { translation: entry.translation });
        continue;
      }
      store.add({ ...entry.saved, id, translation: entry.translation });
      added++;
    }
    const parts = [`${plural(added, 'verbe ajouté', 'verbes ajoutés')}`];
    if (existing) parts.push(`${existing} déjà présent${existing > 1 ? 's' : ''}`);
    if (unknown.length) parts.push(`non reconnu${unknown.length > 1 ? 's' : ''} : ${unknown.slice(0, 5).join(', ')}${unknown.length > 5 ? '…' : ''}`);
    toast(`Import : ${parts.join(' · ')}`);
  }

  const date = () => new Date().toISOString().slice(0, 10);

  return h('footer', { class: 'app-footer' },
    h('div', { class: 'footer-actions' },
      h('button', { type: 'button', class: 'btn', onclick: () => {
        download(`verbheft-${date()}.json`, toJson(store.all()), 'application/json');
      } }, 'Sauvegarder (JSON)'),
      h('button', { type: 'button', class: 'btn', onclick: () => {
        const rows = store.all().map((verb) => {
          const conj = lexicon.conjugateSaved(verb);
          const p = conj?.principalParts;
          return {
            verb,
            principalParts: p ? `${p.infinitive} – ${p.present3} – ${p.preterite3} – ${p.perfect3}` : '',
            verbClass: conj ? VERB_CLASS_LABELS[conj.verbClass] : '',
            auxiliary: conj?.auxiliary ?? '',
          };
        });
        download(`verbheft-${date()}.csv`, toCsv(rows), 'text/csv;charset=utf-8');
      } }, 'Exporter (CSV)'),
      h('button', { type: 'button', class: 'btn', onclick: () => fileInput.click() }, 'Importer…'),
      fileInput,
    ),
    !store.persistent && h('p', { class: 'warning' },
      'Ton navigateur n’autorise pas l’enregistrement : les verbes seront perdus à la fermeture. Pense à sauvegarder.'),
    h('p', { class: 'hint' },
      'Tes verbes sont enregistrés dans ce navigateur, sur cet appareil. ',
      'La sauvegarde JSON permet de les transférer ou de les restaurer.'),
    h('p', { class: 'credits' },
      `Conjugaisons : ${lexicon.index.size.toLocaleString('fr-FR')} verbes issus de `,
      h('a', { href: 'https://github.com/RosaeNLG/rosaenlg/tree/master/packages/german-verbs-dict', target: '_blank', rel: 'noopener' }, 'german-verbs-dict'),
      ' (données Morphy / korrekturen.de, ',
      h('a', { href: 'https://creativecommons.org/licenses/by-sa/4.0/deed.fr', target: '_blank', rel: 'noopener' }, 'CC BY-SA 4.0'),
      ').'),
  );
}

function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n} ${n > 1 ? pluralForm : singular}`;
}

/** Minuscules sans accents, pour la recherche. */
function fold(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/ß/g, 'ss');
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
