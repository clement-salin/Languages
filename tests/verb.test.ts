import { describe, expect, it } from 'vitest';
import { cleanGermanSuggestion } from '../src/domain/de/suggestion';
import { lookupVerb } from '../src/domain/de/verb';
import { conj, dict, forms, parts } from './helpers';

describe('formes principales', () => {
  it.each([
    ['fahren', 'fahren – fährt – fuhr – ist gefahren'],
    ['gehen', 'gehen – geht – ging – ist gegangen'],
    ['essen', 'essen – isst – aß – hat gegessen'],
    ['anrufen', 'anrufen – ruft an – rief an – hat angerufen'],
    ['sich freuen', 'sich freuen – freut sich – freute sich – hat sich gefreut'],
    ['sich anziehen', 'sich anziehen – zieht sich an – zog sich an – hat sich angezogen'],
    ['aufstehen', 'aufstehen – steht auf – stand auf – ist aufgestanden'],
    ['bringen', 'bringen – bringt – brachte – hat gebracht'],
    ['arbeiten', 'arbeiten – arbeitet – arbeitete – hat gearbeitet'],
    ['sein', 'sein – ist – war – ist gewesen'],
    ['werden', 'werden – wird – wurde – ist geworden'],
    ['vorbereiten', 'vorbereiten – bereitet vor – bereitete vor – hat vorbereitet'],
  ])('%s', (input, expected) => {
    expect(parts(conj(input))).toBe(expected);
  });
});

describe('temps', () => {
  it('conjugue le présent avec changement de voyelle', () => {
    const c = conj('fahren');
    expect(forms(c, 'praesens')).toEqual(['fahre', 'fährst', 'fährt', 'fahren', 'fahrt', 'fahren']);
    expect(c.tenses[0].forms.map((f) => f?.irregular)).toEqual([false, true, true, false, false, false]);
    expect(c.presentStemChange).toBe(true);
  });

  it('construit les temps composés', () => {
    const c = conj('gehen');
    expect(forms(c, 'perfekt')[0]).toBe('bin gegangen');
    expect(forms(c, 'plusquamperfekt')[2]).toBe('war gegangen');
    expect(forms(c, 'futur1')[1]).toBe('wirst gehen');
    expect(forms(c, 'futur2')[0]).toBe('werde gegangen sein');
    expect(forms(c, 'konjunktiv2')[0]).toBe('ginge');
    expect(forms(c, 'konjunktiv2Wuerde')[0]).toBe('würde gehen');
    expect(forms(c, 'konjunktiv2Vergangenheit')[0]).toBe('wäre gegangen');
    expect(forms(c, 'konjunktiv1')[2]).toBe('gehe');
  });

  it('place le pronom réfléchi et la particule', () => {
    const c = conj('sich anziehen');
    expect(forms(c, 'praesens')).toEqual([
      'ziehe mich an', 'ziehst dich an', 'zieht sich an', 'ziehen uns an', 'zieht euch an', 'ziehen sich an',
    ]);
    expect(forms(c, 'perfekt')[0]).toBe('habe mich angezogen');
    expect(forms(c, 'futur1')[0]).toBe('werde mich anziehen');
  });

  it('gère les pronoms réfléchis au datif', () => {
    const c = conj('sich vorstellen');
    expect(c.reflexiveCase).toBe('dat');
    expect(forms(c, 'praesens')[0]).toBe('stelle mir vor');
    expect(forms(conj('sich freuen', { reflexiveCase: 'dat' }), 'praesens')[1]).toBe('freust dir');
  });

  it('corrige les tables des modaux', () => {
    expect(forms(conj('müssen'), 'praeteritum')).toEqual(['musste', 'musstest', 'musste', 'mussten', 'musstet', 'mussten']);
    expect(forms(conj('dürfen'), 'konjunktiv1')).toEqual(['dürfe', 'dürfest', 'dürfe', 'dürfen', 'dürfet', 'dürfen']);
    expect(forms(conj('möchten'), 'praesens')[0]).toBe('möchte');
    expect(conj('können').imperative).toBeNull();
    expect(conj('können').verbClass).toBe('modal');
  });
});

describe('impératif', () => {
  it.each([
    ['kommen', 'komm(e)', 'kommt', 'kommen Sie'],
    ['geben', 'gib', 'gebt', 'geben Sie'],
    ['lesen', 'lies', 'lest', 'lesen Sie'],
    ['arbeiten', 'arbeite', 'arbeitet', 'arbeiten Sie'],
    ['sein', 'sei', 'seid', 'seien Sie'],
    ['anrufen', 'ruf(e) an', 'ruft an', 'rufen Sie an'],
    ['sich beeilen', 'beeil(e) dich', 'beeilt euch', 'beeilen Sie sich'],
    ['vergessen', 'vergiss', 'vergesst', 'vergessen Sie'],
  ])('%s', (input, du, ihr, Sie) => {
    expect(conj(input).imperative).toEqual({ du, ihr, Sie });
  });
});

describe('auxiliaire', () => {
  it('choisit sein pour les verbes de déplacement, y compris à particule', () => {
    expect(conj('ankommen').auxiliary).toBe('sein');
    expect(conj('einschlafen').auxiliary).toBe('sein');
    expect(conj('passieren').auxiliary).toBe('sein');
    expect(conj('bekommen').auxiliary).toBe('haben');
    expect(conj('gefallen').auxiliary).toBe('haben');
  });

  it('laisse choisir pour les verbes à double emploi', () => {
    const c = conj('fahren');
    expect(c.auxiliaryInfo).toEqual({ default: 'sein', both: true });
    expect(forms(conj('fahren', { auxiliary: 'haben' }), 'perfekt')[2]).toBe('hat gefahren');
  });
});

describe('verbes à particule', () => {
  it('corrige les verbes inséparables marqués séparables par le dictionnaire', () => {
    const c = conj('wiederholen');
    expect(c.verb.separability).toBe('inseparable');
    expect(parts(c)).toBe('wiederholen – wiederholt – wiederholte – hat wiederholt');
    expect(parts(conj('unterschreiben'))).toBe('unterschreiben – unterschreibt – unterschrieb – hat unterschrieben');
  });

  it('propose les deux emplois de übersetzen', () => {
    expect(parts(conj('übersetzen'))).toBe('übersetzen – übersetzt – übersetzte – hat übersetzt');
    expect(parts(conj('übersetzen', { separable: true }))).toBe('übersetzen – setzt über – setzte über – hat übergesetzt');
  });

  it('reconnaît les composés non marqués et les locutions', () => {
    expect(parts(conj('kennenlernen'))).toBe('kennenlernen – lernt kennen – lernte kennen – hat kennengelernt');
    expect(parts(conj('spazieren gehen'))).toBe('spazieren gehen – geht spazieren – ging spazieren – ist spazieren gegangen');
    expect(parts(conj('Rad fahren'))).toBe('Rad fahren – fährt Rad – fuhr Rad – ist Rad gefahren');
    expect(parts(conj('Spazieren gehen'))).toBe('spazieren gehen – geht spazieren – ging spazieren – ist spazieren gegangen');
  });

  it('devine les verbes absents du dictionnaire', () => {
    expect(parts(conj('mitkommen'))).toBe('mitkommen – kommt mit – kam mit – ist mitgekommen');
    expect(parts(conj('herunterladen'))).toBe('herunterladen – lädt herunter – lud herunter – hat heruntergeladen');
  });
});

describe('saisie', () => {
  it('tolère majuscules, espaces et claviers sans umlaut', () => {
    expect(conj('  Fahren ').verb.infinitive).toBe('fahren');
    expect(conj('fuehren').verb.infinitive).toBe('führen');
    expect(conj('geniessen').verb.infinitive).toBe('genießen');
    expect(conj('an rufen').verb.infinitive).toBe('anrufen');
    expect(conj('Sich freuen').verb.reflexive).toBe(true);
  });

  it('signale les verbes inconnus', () => {
    expect(lookupVerb(dict, 'blablabla')).toEqual({ ok: false, reason: 'not-found' });
    expect(lookupVerb(dict, '   ')).toEqual({ ok: false, reason: 'empty' });
  });
});

describe('classification', () => {
  it.each([
    ['machen', 'weak'], ['sammeln', 'weak'], ['studieren', 'weak'], ['finden', 'strong'],
    ['denken', 'mixed'], ['kennen', 'mixed'], ['haben', 'irregular'], ['wollen', 'modal'],
  ])('%s → %s', (input, expected) => {
    expect(conj(input).verbClass).toBe(expected);
  });
});

it('conjugue tout le dictionnaire sans erreur', () => {
  let incomplete = 0;
  for (const key of Object.keys(dict)) {
    const result = lookupVerb(dict, key);
    if (result.ok) {
      expect(() => conj(key)).not.toThrow();
      if (conj(key).incomplete) incomplete++;
    }
  }
  // Quelques entrées du dictionnaire source sont lacunaires.
  expect(incomplete).toBeLessThan(60);
});

describe('verbe proposé depuis le français', () => {
  it('ramène la proposition à un infinitif cherchable', () => {
    expect(cleanGermanSuggestion(' Fahren. ')).toBe('Fahren');
    expect(cleanGermanSuggestion('zu fahren')).toBe('fahren');
    expect(cleanGermanSuggestion('„sich zu freuen“')).toBe('sich freuen');
  });

  it('se retrouve ensuite dans le dictionnaire, nom compris', () => {
    for (const raw of ['Fahren', 'zu fahren', 'sich freuen', 'anrufen']) {
      expect(lookupVerb(dict, cleanGermanSuggestion(raw)).ok).toBe(true);
    }
  });
});
