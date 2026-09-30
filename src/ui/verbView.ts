import type { Auxiliary } from '../core/auxiliary';
import {
  PERSONS, VERB_CLASS_LABELS, type Conjugation, type ReflexiveCase, type Tense, type TenseId,
} from '../core/verb';
import type { SavedVerb } from '../storage';
import { debounce, h, toast } from './dom';
import type { AppContext } from './listView';

/** Temps affichés d'emblée ; les autres sont regroupés dans « Autres temps ». */
const MAIN_TENSES: TenseId[] = [
  'praesens', 'perfekt', 'praeteritum', 'futur1', 'plusquamperfekt', 'konjunktiv2Wuerde', 'konjunktiv2',
];

export function renderVerbView(root: HTMLElement, ctx: AppContext, id: string): void {
  const saved = ctx.store.get(id);
  if (!saved) {
    root.replaceChildren(
      backLink(),
      h('section', { class: 'card' },
        h('h1', {}, 'Verbe introuvable'),
        h('p', {}, `« ${id} » n'est pas (ou plus) dans ton carnet.`),
      ),
    );
    return;
  }
  const conj = ctx.lexicon.conjugateSaved(saved);
  root.replaceChildren(
    backLink(),
    header(ctx, saved, conj),
    ...(conj ? conjugationSections(ctx, saved, conj) : [unknownVerb(saved)]),
    notesSection(ctx, saved),
    dangerZone(ctx, saved),
  );
  document.title = `${saved.id} · Verbheft`;
}

function backLink(): HTMLElement {
  return h('nav', { class: 'back' }, h('a', { href: '#/' }, '← Mon carnet'));
}

function header(ctx: AppContext, saved: SavedVerb, conj: Conjugation | null): HTMLElement {
  const translation = h('input', {
    class: 'input translation-edit',
    type: 'text',
    value: saved.translation,
    placeholder: 'Ajouter une traduction…',
    'aria-label': 'Traduction en français',
    oninput: debounce(() => ctx.store.update(saved.id, { translation: translation.value.trim() }), 400),
  });
  const badges = conj ? verbBadges(conj) : [];
  return h('header', { class: 'verb-header' },
    h('h1', { lang: 'de' }, conj?.displayInfinitive ?? saved.id),
    translation,
    badges.length > 0 && h('ul', { class: 'badges', 'aria-label': 'Caractéristiques' },
      badges.map(([cls, label, title]) => h('li', { class: `badge ${cls}`, title }, label)),
    ),
  );
}

function verbBadges(conj: Conjugation): [string, string, string][] {
  const out: [string, string, string][] = [];
  const cls = conj.verbClass;
  const classTitles: Record<typeof cls, string> = {
    weak: 'Verbe faible (régulier) : prétérit en -te, participe en -t',
    strong: 'Verbe fort : le radical change au prétérit, participe en -en',
    mixed: 'Verbe mixte : radical modifié mais terminaisons faibles (-te, -t)',
    modal: 'Verbe de modalité',
    irregular: 'Verbe irrégulier',
  };
  out.push([`badge-${cls}`, VERB_CLASS_LABELS[cls], classTitles[cls]]);
  out.push(['badge-aux', `+ ${conj.auxiliary}`, `Temps composés avec « ${conj.auxiliary} »`]);
  if (conj.verb.prefix && conj.separable) {
    out.push(['badge-plain', `particule « ${conj.verb.prefix} »`, 'Particule séparable : elle se place en fin de proposition']);
  } else if (conj.verb.prefix && conj.verb.separability !== 'separable') {
    out.push(['badge-plain', 'inséparable', `« ${conj.verb.prefix} » reste attaché au verbe`]);
  }
  if (conj.presentStemChange) {
    out.push(['badge-change', 'radical modifié au présent', 'Voir les formes en couleur au Präsens']);
  }
  if (conj.verb.reflexive) out.push(['badge-plain', 'pronominal', 'Verbe réfléchi (sich …)']);
  return out;
}

function unknownVerb(saved: SavedVerb): HTMLElement {
  return h('section', { class: 'card' },
    h('p', {}, `« ${saved.id} » n'a pas été trouvé dans le dictionnaire : impossible d'afficher sa conjugaison.`),
  );
}

function conjugationSections(ctx: AppContext, saved: SavedVerb, conj: Conjugation): HTMLElement[] {
  const pp = conj.principalParts;
  const sections: HTMLElement[] = [
    h('section', { class: 'card principal', 'aria-labelledby': 'pp-title' },
      h('h2', { id: 'pp-title' }, 'Formes principales'),
      h('p', { class: 'principal-parts', lang: 'de' },
        h('span', {}, pp.infinitive), h('span', { class: 'sep' }, '–'),
        h('span', {}, pp.present3), h('span', { class: 'sep' }, '–'),
        h('span', {}, pp.preterite3), h('span', { class: 'sep' }, '–'),
        h('span', {}, pp.perfect3),
      ),
      h('p', { class: 'hint' }, 'infinitif – présent (er) – prétérit (er) – parfait (er)'),
      conj.participles.length > 1 && h('p', { class: 'hint' },
        `Participes passés possibles : ${conj.participles.join(', ')}`),
      options(ctx, saved, conj),
    ),
  ];

  if (conj.incomplete) {
    sections.push(h('p', { class: 'warning' },
      'Certaines formes manquent dans le dictionnaire pour ce verbe : elles apparaissent comme « — ».'));
  }

  const byId = new Map(conj.tenses.map((t) => [t.id, t]));
  const main = MAIN_TENSES.map((id) => byId.get(id)).filter((t): t is Tense => !!t);
  const others = conj.tenses.filter((t) => !MAIN_TENSES.includes(t.id));

  sections.push(
    h('section', { class: 'tenses', 'aria-label': 'Conjugaison' },
      main.map((t) => tenseCard(t)),
      conj.imperative && imperativeCard(conj),
    ),
    h('details', { class: 'more-tenses' },
      h('summary', {}, 'Autres temps'),
      h('div', { class: 'tenses' }, others.map((t) => tenseCard(t))),
    ),
  );
  if (conj.presentStemChange) {
    sections.push(h('p', { class: 'hint legend' },
      h('mark', {}, 'En couleur'), ' : formes dont le radical change au présent.'));
  }
  return sections;
}

/** Réglages quand le verbe admet plusieurs conjugaisons. */
function options(ctx: AppContext, saved: SavedVerb, conj: Conjugation): HTMLElement | null {
  const controls: HTMLElement[] = [];
  const rerender = () => {
    const main = document.getElementById('app');
    if (main) renderVerbView(main, ctx, saved.id);
  };

  if (!conj.verb.reflexive) {
    controls.push(segmented<Auxiliary>(
      'Auxiliaire', conj.auxiliary,
      [['haben', 'haben'], ['sein', 'sein']],
      (value) => {
        ctx.store.update(saved.id, { auxiliary: value === conj.auxiliaryInfo.default ? undefined : value });
        rerender();
      },
      conj.auxiliaryInfo.both
        ? 'Ce verbe prend « sein » pour un déplacement et « haben » avec un complément d’objet.'
        : undefined,
    ));
  }
  if (conj.verb.reflexive) {
    controls.push(segmented<ReflexiveCase>(
      'Pronom réfléchi', conj.reflexiveCase,
      [['acc', 'accusatif (mich)'], ['dat', 'datif (mir)']],
      (value) => {
        ctx.store.update(saved.id, { reflexiveCase: value });
        rerender();
      },
    ));
  }
  if (conj.verb.separability === 'both' && conj.verb.prefix) {
    const prefix = conj.verb.prefix;
    controls.push(segmented<'sep' | 'insep'>(
      'Particule', conj.separable ? 'sep' : 'insep',
      [['insep', `inséparable (${prefix}…t)`], ['sep', `séparable (… ${prefix})`]],
      (value) => {
        ctx.store.update(saved.id, { separable: value === 'sep' });
        rerender();
      },
      'Le sens change : « er übersetzt » (il traduit) / « er setzt über » (il traverse).',
    ));
  }
  return controls.length ? h('div', { class: 'options' }, controls) : null;
}

function segmented<T extends string>(
  label: string,
  current: T,
  choices: [T, string][],
  onChange: (value: T) => void,
  help?: string,
): HTMLElement {
  return h('div', { class: 'option' },
    h('span', { class: 'option-label' }, label),
    h('div', { class: 'segmented', role: 'group', 'aria-label': label },
      choices.map(([value, text]) =>
        h('button', {
          type: 'button',
          'aria-pressed': String(value === current),
          onclick: () => {
            if (value !== current) onChange(value);
          },
        }, text),
      ),
    ),
    help && h('p', { class: 'hint' }, help),
  );
}

function tenseCard(tense: Tense): HTMLElement {
  return h('article', { class: 'card tense' },
    h('h3', {}, h('span', { lang: 'de' }, tense.name), h('small', {}, tense.french)),
    h('table', { lang: 'de' },
      h('tbody', {},
        tense.forms.map((form, i) =>
          h('tr', {},
            h('th', { scope: 'row' }, PERSONS[i]),
            h('td', {}, form ? (form.irregular ? h('mark', {}, form.text) : form.text) : '—'),
          ),
        ),
      ),
    ),
  );
}

function imperativeCard(conj: Conjugation): HTMLElement {
  const imp = conj.imperative!;
  const rows: [string, string][] = [['(du)', `${imp.du} !`], ['(ihr)', `${imp.ihr} !`], ['(Sie)', `${imp.Sie} !`]];
  return h('article', { class: 'card tense' },
    h('h3', {}, h('span', { lang: 'de' }, 'Imperativ'), h('small', {}, 'impératif')),
    h('table', { lang: 'de' },
      h('tbody', {}, rows.map(([p, f]) => h('tr', {}, h('th', { scope: 'row' }, p), h('td', {}, f)))),
    ),
    imp.du.includes('(e)') && h('p', { class: 'hint' }, 'Le « e » final est facultatif (surtout à l’oral).'),
  );
}

function notesSection(ctx: AppContext, saved: SavedVerb): HTMLElement {
  const notes = h('textarea', {
    class: 'input',
    rows: 3,
    placeholder: 'Une phrase d’exemple de ta leçon, une astuce…',
    'aria-label': 'Notes',
    oninput: debounce(() => ctx.store.update(saved.id, { notes: notes.value }), 400),
  });
  notes.value = saved.notes;
  const word = saved.id.replace(/^sich /, '').split(' ').pop() ?? saved.id;
  const added = new Date(saved.addedAt);
  return h('section', { class: 'card', 'aria-labelledby': 'notes-title' },
    h('h2', { id: 'notes-title' }, 'Notes'),
    notes,
    h('p', { class: 'hint' },
      `Ajouté le ${added.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} · `,
      h('a', { href: `https://fr.wiktionary.org/wiki/${encodeURIComponent(word)}`, target: '_blank', rel: 'noopener' }, 'Wiktionnaire'),
      ' · ',
      h('a', { href: `https://www.dwds.de/wb/${encodeURIComponent(word)}`, target: '_blank', rel: 'noopener' }, 'DWDS'),
    ),
  );
}

function dangerZone(ctx: AppContext, saved: SavedVerb): HTMLElement {
  return h('div', { class: 'danger' },
    h('button', {
      type: 'button',
      class: 'btn btn-danger',
      onclick: () => {
        if (!confirm(`Supprimer « ${saved.id} » de ton carnet ?`)) return;
        ctx.store.remove(saved.id);
        toast(`« ${saved.id} » supprimé.`);
        location.hash = '#/';
      },
    }, 'Supprimer ce verbe'),
  );
}
