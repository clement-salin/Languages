import { useEffect, useRef, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { deVerbs } from '../data/de-verbs';
import { enPhrasals } from '../data/en-phrasals';
import { useLexicon, useSyncState } from '../data/hooks';
import type { Lexicon } from '../data/lexicon';
import { pendingCount, readToken, syncNow, writeToken } from '../data/sync';
import { phrasalsFromBackup, toBackupJson } from '../domain/backup';
import { normalizeSavedVerb } from '../domain/de/saved-verb';
import { parseImport, toCsv } from '../domain/de/transfer';
import { VERB_CLASS_LABELS } from '../domain/de/verb';
import { plural } from '../domain/text';

/** Synchronisation entre appareils, sauvegarde et import. */
export function SettingsPage() {
  return (
    <>
      <PageHeader title="Réglages" />
      <div className="flex max-w-2xl flex-col gap-5 px-5 pb-8 lg:px-8">
        <SyncSection />
        <BackupSection />
        <Credits />
      </div>
    </>
  );
}

const card = 'rounded-[14px] border border-line bg-surface p-5';
const button = 'min-h-10 cursor-pointer rounded-[10px] border border-line-strong bg-surface px-3.5 text-sm text-ink-2 disabled:cursor-default disabled:opacity-60';
const primary = 'min-h-10 cursor-pointer rounded-[10px] border-0 bg-ink-2 px-4 text-sm font-semibold text-white disabled:cursor-default disabled:opacity-60';

function SyncSection() {
  const state = useSyncState();
  const [token, setToken] = useState(readToken);
  const [saved, setSaved] = useState(readToken() !== '');
  const [pending, setPending] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void pendingCount().then(setPending);
  }, [state.lastAt]);

  async function run(): Promise<void> {
    setMessage(null);
    try {
      const outcome = await syncNow();
      const parts = [`${outcome.sent} envoyé${outcome.sent > 1 ? 's' : ''}`, `${outcome.received} reçu${outcome.received > 1 ? 's' : ''}`];
      if (outcome.removed) parts.push(`${outcome.removed} supprimé${outcome.removed > 1 ? 's' : ''}`);
      setMessage(`Synchronisé : ${parts.join(', ')}.`);
    } catch {
      // L'erreur est dans `state.lastError`.
    }
  }

  return (
    <section aria-labelledby="sync-title" className={card}>
      <h2 id="sync-title" className="m-0 text-lg font-semibold">Synchronisation</h2>
      <p className="mt-1 mb-4 text-sm text-ink-3">
        Le carnet est enregistré sur cet appareil et fonctionne sans réseau. Avec le jeton du serveur, il s’échange
        tout seul avec tes autres appareils : au lancement, au retour dans l’app et après chaque modification.
      </p>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          writeToken(token);
          setSaved(token.trim() !== '');
          if (token.trim() !== '') void run();
        }}
      >
        <label htmlFor="sync-token" className="sr-only">Jeton de synchronisation</label>
        <input
          id="sync-token"
          type="password"
          autoComplete="off"
          value={token}
          onChange={(e) => {
            setToken(e.target.value);
            setSaved(false);
          }}
          placeholder="Jeton de synchronisation"
          className="h-10 flex-1 rounded-[10px] border border-line-strong bg-surface px-3 text-base lg:text-sm"
        />
        <button type="submit" className={primary} disabled={saved && token.trim() !== ''}>
          {saved && token.trim() !== '' ? 'Enregistré' : 'Enregistrer'}
        </button>
      </form>
      {readToken() !== '' && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className={button} disabled={state.running} onClick={() => void run()}>
            {state.running ? 'Synchronisation…' : 'Synchroniser maintenant'}
          </button>
          <span className="text-sm text-ink-soft">
            {state.lastAt && `Dernier échange : ${new Date(state.lastAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`}
            {pending !== null && pending > 0 && ` · ${plural(pending, 'modification')} en attente`}
          </span>
        </div>
      )}
      {state.lastError && (
        <p role="alert" className="m-0 mt-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{state.lastError}</p>
      )}
      {message && !state.lastError && <p className="m-0 mt-3 text-sm text-ink-3">{message}</p>}
    </section>
  );
}

function download(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function BackupSection() {
  const { lexicon } = useLexicon();
  const [report, setReport] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const date = () => new Date().toISOString().slice(0, 10);

  async function exportJson(): Promise<void> {
    const [verbs, phrasals] = await Promise.all([deVerbs.all(), enPhrasals.all()]);
    download(`languages-${date()}.json`, toBackupJson(verbs, phrasals), 'application/json');
  }

  async function exportCsv(lex: Lexicon): Promise<void> {
    const rows = (await deVerbs.all()).map((verb) => {
      const conj = lex.conjugateSaved(verb);
      const p = conj?.principalParts;
      return {
        verb,
        principalParts: p ? `${p.infinitive} – ${p.present3} – ${p.preterite3} – ${p.perfect3}` : '',
        verbClass: conj ? VERB_CLASS_LABELS[conj.verbClass] : '',
        auxiliary: conj?.auxiliary ?? '',
      };
    });
    download(`languages-allemand-${date()}.csv`, toCsv(rows), 'text/csv;charset=utf-8');
  }

  async function importFile(text: string, lex: Lexicon): Promise<void> {
    let added = 0;
    let existing = 0;
    const unknown: string[] = [];
    const now = new Date().toISOString();

    for (const entry of parseImport(text)) {
      const result = lex.lookup(entry.input);
      if (!result.ok) {
        unknown.push(entry.input);
        continue;
      }
      const id = result.verb.reflexive ? `sich ${result.verb.infinitive}` : result.verb.infinitive;
      const current = await deVerbs.get(id);
      if (current) {
        existing++;
        if (!current.translation && entry.translation) {
          await deVerbs.put({ ...current, translation: entry.translation, updatedAt: now });
        }
        continue;
      }
      const verb = normalizeSavedVerb({ ...entry.saved, id, translation: entry.translation, updatedAt: now }, now);
      if (verb) {
        await deVerbs.put(verb);
        added++;
      }
    }

    for (const phrasal of phrasalsFromBackup(text)) {
      if (await enPhrasals.get(phrasal.id)) {
        existing++;
        continue;
      }
      await enPhrasals.put({ ...phrasal, updatedAt: now });
      added++;
    }

    const parts = [`${added} ajouté${added > 1 ? 's' : ''}`];
    if (existing) parts.push(`${existing} déjà présent${existing > 1 ? 's' : ''}`);
    if (unknown.length) {
      parts.push(`non reconnu${unknown.length > 1 ? 's' : ''} : ${unknown.slice(0, 5).join(', ')}${unknown.length > 5 ? '…' : ''}`);
    }
    setReport(`Import : ${parts.join(' · ')}.`);
  }

  return (
    <section aria-labelledby="backup-title" className={card}>
      <h2 id="backup-title" className="m-0 text-lg font-semibold">Sauvegarde</h2>
      <p className="mt-1 mb-4 text-sm text-ink-3">
        Le fichier JSON contient tout le carnet, allemand et anglais, et se réimporte ici. Le CSV liste les verbes
        allemands pour un tableur. L’import accepte aussi les sauvegardes de Verbheft et une simple liste de verbes
        allemands, un par ligne (« verbe;traduction »).
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} onClick={() => void exportJson()}>Sauvegarder (JSON)</button>
        <button type="button" className={button} disabled={!lexicon} onClick={() => lexicon && void exportCsv(lexicon)}>
          Verbes allemands (CSV)
        </button>
        <button type="button" className={button} disabled={!lexicon} onClick={() => fileRef.current?.click()}>
          Importer…
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.csv,.txt,application/json,text/csv,text/plain"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file || !lexicon) return;
            try {
              await importFile(await file.text(), lexicon);
            } catch {
              setReport('Fichier illisible : choisis une sauvegarde JSON ou un CSV.');
            }
          }}
        />
      </div>
      {report && <p role="status" className="m-0 mt-3 text-sm text-ink-3">{report}</p>}
    </section>
  );
}

function Credits() {
  return (
    <p className="m-0 text-xs text-ink-soft">
      Conjugaisons allemandes : dictionnaire{' '}
      <a href="https://github.com/RosaeNLG/rosaenlg/tree/master/packages/german-verbs-dict" target="_blank" rel="noopener" className="text-ink-3">
        german-verbs-dict
      </a>{' '}
      (données Morphy / korrekturen.de,{' '}
      <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.fr" target="_blank" rel="noopener" className="text-ink-3">CC BY-SA 4.0</a>).
    </p>
  );
}
