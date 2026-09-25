import { useEffect, useRef } from 'react';

/**
 * Calls `save(value)` shortly after `value` stops changing, and once more on
 * unmount, so in-progress edits survive the app being closed mid-step.
 */
export function useAutosave<T>(value: T, save: (value: T) => void, delayMs = 400) {
  const saveRef = useRef(save);
  saveRef.current = save;
  const latest = useRef(value);
  const dirty = useRef(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    latest.current = value;
    dirty.current = true;
    const t = setTimeout(() => {
      dirty.current = false;
      saveRef.current(value);
    }, delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  useEffect(
    () => () => {
      if (dirty.current) saveRef.current(latest.current);
    },
    [],
  );
}
