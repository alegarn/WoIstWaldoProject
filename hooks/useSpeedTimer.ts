import { useEffect, useRef, useState } from 'react';

export const TIMER_TICK_MS = 100;

type TimerHandle = ReturnType<typeof setInterval> | null;

export type UseSpeedTimerResult = { elapsedMs: number };

export function useSpeedTimer({ active }: { active: boolean }): UseSpeedTimerResult {
  const [elapsedMs, setElapsedMs] = useState(0);
  const elapsedAccumRef = useRef(0);
  const runStartRef = useRef(0);
  const intervalRef = useRef<TimerHandle>(null);

  useEffect(() => {
    if (!active) {
      return undefined;
    }
    runStartRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      setElapsedMs(elapsedAccumRef.current + (Date.now() - runStartRef.current));
    }, TIMER_TICK_MS);
    return () => {
      elapsedAccumRef.current += Date.now() - runStartRef.current;
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, [active]);

  return { elapsedMs };
}
