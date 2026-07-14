import { useCallback, useEffect, useRef, useState } from 'react';

// Reading grace for the speed chrono on cards whose description/enigma opens by
// default (2nd+ card). The chrono starts at the earliest of: the user closing the
// description via markClosed, or READING_GRACE_MS elapsing.
export const READING_GRACE_MS = 3000;

export function useReadingGrace({ enabled, graceMs = READING_GRACE_MS }) {
  const [graceDone, setGraceDone] = useState(() => !enabled);
  const doneRef = useRef(!enabled);

  useEffect(() => {
    if (!enabled || doneRef.current) {
      return undefined;
    }
    const id = setTimeout(() => {
      doneRef.current = true;
      setGraceDone(true);
    }, graceMs);
    return () => clearTimeout(id);
  }, [enabled, graceMs]);

  const markClosed = useCallback(() => {
    if (!doneRef.current) {
      doneRef.current = true;
      setGraceDone(true);
    }
  }, []);

  return { graceDone, markClosed };
}
