import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  getSessionLanguageFilterSync,
  getSessionModeFilterSync,
  getPreferredLanguageSync,
  isStorageMigratedSync,
  saveSessionLanguageFilter,
  saveSessionModeFilter,
} from '../utils/storageDatum';
import { ensureMigrated } from '../utils/storageMigration';

/**
 * One-way entry hints (e.g. route params applied once at GuessPathScreen
 * press). Assumption: hints are derived from the SAME storage source the
 * provider mirrors — so a hint of `'any'` against an explicit context value
 * still overwrites state (unpersisted). Future entry points that need
 * hint-wins-over-explicit semantics must extend `applyHintValue`
 * explicitly; do not grow this type to encode them.
 */
export type SessionFilterHints = {
  mode?: string | null;
  language?: string | null;
};

type SessionFilterState = {
  mode: string | null;
  language: string | null;
};

type SessionFilterContextValue = SessionFilterState & {
  setModeFilter: (mode: string | null) => void;
  setLanguageFilter: (code: string | null) => void;
  /**
   * Apply one-way entry hints to state (never persisted, never wipes: a null
   * hint keeps the current value; a never-set null stays null against 'any').
   * Hints assume same-source derivation — a hint 'any' over an explicit
   * context value updates state unpersisted (see SessionFilterHints).
   */
  applyHints: (hints: SessionFilterHints) => void;
};

const SessionFilterContext = createContext<SessionFilterContextValue>({
  mode: null,
  language: null,
  setModeFilter: () => {},
  setLanguageFilter: () => {},
  applyHints: () => {},
});

function readSyncedSessionFilters(): SessionFilterState {
  return {
    mode: getSessionModeFilterSync(),
    language: getSessionLanguageFilterSync() ?? getPreferredLanguageSync(),
  };
}

function readInitialSessionFilters(): SessionFilterState {
  if (!isStorageMigratedSync()) {
    return { mode: null, language: null };
  }
  return readSyncedSessionFilters();
}

// A hint of 'any' against a never-set null keeps null (never-set ≠ explicit 'any');
// a null hint preserves the current value (hints never wipe).
function applyHintValue(current: string | null, hint: string | null | undefined): string | null {
  if (hint === undefined || hint === null) {
    return current;
  }
  if (hint === 'any' && current === null) {
    return current;
  }
  return hint;
}

/**
 * App-root owner of the session guess filters (mode + language), mirrored in
 * MMKV through the storageDatum accessors. Synchronous init — no restore
 * race; `null` = never set, distinct from an explicit `'any'`. Provider-less
 * consumers resolve to the never-set default without throwing.
 */
export default function SessionFilterProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionFilterState>(readInitialSessionFilters);
  const selectionEpochRef = useRef(0);

  // Migration window mitigation: a sync read skips the AsyncStorage→MMKV
  // one-shot copy, so while the migration flag is missing we start from
  // defaults and re-read once `ensureMigrated()` resolves. Post-first-launch
  // the flag is always set and this effect is a no-op. The selection-epoch
  // guard keeps "selection wins": any setter/applyHints call since mount
  // means the user owns the in-memory state, so the re-read is skipped
  // instead of clobbering it.
  useEffect(() => {
    if (isStorageMigratedSync()) {
      return;
    }

    let mounted = true;

    ensureMigrated()
      .then(() => {
        if (mounted && selectionEpochRef.current === 0) {
          setState(readSyncedSessionFilters());
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  const setModeFilter = useCallback((mode: string | null) => {
    selectionEpochRef.current += 1;
    setState((prev) => ({ ...prev, mode }));
    void saveSessionModeFilter(mode).catch(() => {});
  }, []);

  const setLanguageFilter = useCallback((code: string | null) => {
    selectionEpochRef.current += 1;
    setState((prev) => ({ ...prev, language: code }));
    void saveSessionLanguageFilter(code).catch(() => {});
  }, []);

  const applyHints = useCallback((hints: SessionFilterHints) => {
    selectionEpochRef.current += 1;
    setState((prev) => {
      const mode = applyHintValue(prev.mode, hints.mode);
      const language = applyHintValue(prev.language, hints.language);
      if (mode === prev.mode && language === prev.language) {
        return prev;
      }
      return { mode, language };
    });
  }, []);

  const value = useMemo(
    () => ({ ...state, setModeFilter, setLanguageFilter, applyHints }),
    [state, setModeFilter, setLanguageFilter, applyHints],
  );

  return (
    <SessionFilterContext.Provider value={value}>
      {children}
    </SessionFilterContext.Provider>
  );
}

export function useSessionModeFilter(): { mode: string | null; setModeFilter: (mode: string | null) => void } {
  const { mode, setModeFilter } = useContext(SessionFilterContext);
  return useMemo(() => ({ mode, setModeFilter }), [mode, setModeFilter]);
}

export function useSessionLanguageFilter(): { language: string | null; setLanguageFilter: (code: string | null) => void } {
  const { language, setLanguageFilter } = useContext(SessionFilterContext);
  return useMemo(() => ({ language, setLanguageFilter }), [language, setLanguageFilter]);
}

export function useSessionFilterHints(): { applyHints: (hints: SessionFilterHints) => void } {
  const { applyHints } = useContext(SessionFilterContext);
  return useMemo(() => ({ applyHints }), [applyHints]);
}
