import { useState } from 'react';
import { enPhrasals, updatePhrasal } from '../../data/en-phrasals';
import type { PhrasalVerb } from '../../domain/en/phrasal';
import { useDebouncedSave } from '../../use-debounced-save';

/** Une expression, modifiable sur place. */
export function PhrasalCard({ phrasal }: { phrasal: PhrasalVerb }) {
  const [editing, setEditing] = useState(false);
  return (
    <section className="flex flex-col gap-1 rounded-xl border border-line bg-surface px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <h3 lang="en" className="m-0 text-[17px] font-medium">
          {phrasal.base} <span className="font-semibold text-accent-text">{phrasal.particle}</span>
        </h3>
        <button
          type="button"
          aria-expanded={editing}
          onClick={() => setEditing((e) => !e)}
          className="-mt-1 -mr-2 min-h-9 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent px-2 text-sm text-accent-text"
        >
          {editing ? 'Fermer' : 'Modifier'}
        </button>
      </div>
      {editing ? (
        <Editor phrasal={phrasal} />
      ) : (
        <>
          <div className="text-ink-2">{phrasal.meaning || <span className="text-ink-faint">Sens à compléter</span>}</div>
          {phrasal.example && <div lang="en" className="text-[13px] text-ink-soft italic">{phrasal.example}</div>}
          {phrasal.notes && <div className="mt-1 text-[13px] whitespace-pre-line text-ink-3">{phrasal.notes}</div>}
        </>
      )}
    </section>
  );
}

function Editor({ phrasal }: { phrasal: PhrasalVerb }) {
  const [meaning, setMeaning] = useState(phrasal.meaning);
  const [example, setExample] = useState(phrasal.example);
  const [notes, setNotes] = useState(phrasal.notes);
  useDebouncedSave(meaning, (value) => void updatePhrasal(phrasal.id, { meaning: value.trim() }));
  useDebouncedSave(example, (value) => void updatePhrasal(phrasal.id, { example: value.trim() }));
  useDebouncedSave(notes, (value) => void updatePhrasal(phrasal.id, { notes: value }));
  const field = 'w-full rounded-[10px] border border-line-strong bg-surface px-3 text-base lg:text-sm';
  const id = phrasal.id.replace(/\W+/g, '-');
  return (
    <div className="mt-2 flex flex-col gap-2">
      <label htmlFor={`${id}-meaning`} className="text-xs text-ink-soft">Sens en français</label>
      <input id={`${id}-meaning`} value={meaning} onChange={(e) => setMeaning(e.target.value)} className={`${field} h-10`} />
      <label htmlFor={`${id}-example`} className="text-xs text-ink-soft">Exemple</label>
      <input id={`${id}-example`} lang="en" value={example} onChange={(e) => setExample(e.target.value)} className={`${field} h-10`} />
      <label htmlFor={`${id}-notes`} className="text-xs text-ink-soft">Notes</label>
      <textarea id={`${id}-notes`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${field} resize-y py-2`} />
      <button
        type="button"
        onClick={() => {
          if (confirm(`Supprimer « ${phrasal.id} » du carnet ?`)) void enPhrasals.remove(phrasal.id);
        }}
        className="mt-1 min-h-9 cursor-pointer self-start rounded-lg border border-line-strong bg-surface px-3 text-sm text-danger"
      >
        Supprimer
      </button>
    </div>
  );
}
