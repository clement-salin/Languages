import { useEffect, useRef } from 'react';

/**
 * Enregistre une saisie après une courte pause de frappe.
 *
 * Si l'on quitte la page avant la fin de la pause, l'enregistrement part
 * tout de suite : sans cela, la dernière phrase tapée serait perdue.
 */
export function useDebouncedSave(value: string, save: (value: string) => void, delay = 400): void {
  const initial = useRef(value);
  const pending = useRef<{ timer: ReturnType<typeof setTimeout>; value: string } | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    if (value === initial.current && pending.current === null) return;
    if (pending.current) clearTimeout(pending.current.timer);
    const timer = setTimeout(() => {
      pending.current = null;
      saveRef.current(value);
    }, delay);
    pending.current = { timer, value };
  }, [value, delay]);

  useEffect(
    () => () => {
      if (pending.current) {
        clearTimeout(pending.current.timer);
        saveRef.current(pending.current.value);
      }
    },
    [],
  );
}
