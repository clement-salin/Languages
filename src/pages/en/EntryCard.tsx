import { useState, type ReactNode } from 'react';
import { useDebouncedSave } from '../../use-debounced-save';

/** Ce qu'une fiche anglaise permet de modifier : le reste fait l'identifiant. */
export interface EditableFields {
  meaning: string;
  example: string;
  notes: string;
}

/**
 * Une fiche anglaise (phrasal verb ou expression), modifiable sur place.
 * Le titre n'est pas modifiable : il fait l'identifiant, partagé entre
 * appareils. Pour le changer, on supprime et on recrée.
 */
export function EntryCard({ id, title, fields, onUpdate, onRemove }: {
  id: string;
  title: ReactNode;
  fields: EditableFields;
  onUpdate: (patch: Partial<EditableFields>) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <section className="flex flex-col gap-1 rounded-xl border border-line bg-surface px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <h3 lang="en" className="m-0 text-[17px] font-medium">{title}</h3>
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
        <Editor id={id} fields={fields} onUpdate={onUpdate} onRemove={onRemove} />
      ) : (
        <>
          <div className="text-ink-2">{fields.meaning || <span className="text-ink-faint">Sens à compléter</span>}</div>
          {fields.example && <div lang="en" className="text-[13px] text-ink-soft italic">{fields.example}</div>}
          {fields.notes && <div className="mt-1 text-[13px] whitespace-pre-line text-ink-3">{fields.notes}</div>}
        </>
      )}
    </section>
  );
}

function Editor({ id, fields, onUpdate, onRemove }: {
  id: string;
  fields: EditableFields;
  onUpdate: (patch: Partial<EditableFields>) => void;
  onRemove: () => void;
}) {
  const [meaning, setMeaning] = useState(fields.meaning);
  const [example, setExample] = useState(fields.example);
  const [notes, setNotes] = useState(fields.notes);
  useDebouncedSave(meaning, (value) => onUpdate({ meaning: value.trim() }));
  useDebouncedSave(example, (value) => onUpdate({ example: value.trim() }));
  useDebouncedSave(notes, (value) => onUpdate({ notes: value }));
  const field = 'w-full rounded-[10px] border border-line-strong bg-surface px-3 text-base lg:text-sm';
  const prefix = id.replace(/\W+/g, '-');
  return (
    <div className="mt-2 flex flex-col gap-2">
      <label htmlFor={`${prefix}-meaning`} className="text-xs text-ink-soft">Sens en français</label>
      <input id={`${prefix}-meaning`} value={meaning} onChange={(e) => setMeaning(e.target.value)} className={`${field} h-10`} />
      <label htmlFor={`${prefix}-example`} className="text-xs text-ink-soft">Exemple</label>
      <input id={`${prefix}-example`} lang="en" value={example} onChange={(e) => setExample(e.target.value)} className={`${field} h-10`} />
      <label htmlFor={`${prefix}-notes`} className="text-xs text-ink-soft">Notes</label>
      <textarea id={`${prefix}-notes`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${field} resize-y py-2`} />
      <button
        type="button"
        onClick={onRemove}
        className="mt-1 min-h-9 cursor-pointer self-start rounded-lg border border-line-strong bg-surface px-3 text-sm text-danger"
      >
        Supprimer
      </button>
    </div>
  );
}
