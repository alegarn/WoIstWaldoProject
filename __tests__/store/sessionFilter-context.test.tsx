import React from 'react';
import { act, create } from 'react-test-renderer';

import SessionFilterProvider, {
  useSessionFilterHints,
  useSessionLanguageFilter,
  useSessionModeFilter,
} from '../../store/sessionFilter-context';

const localStoreMock = jest.requireMock('../../utils/localStore') as {
  __store: Map<string, string>;
  __reset: () => void;
};

const storageMigrationMock = jest.requireMock('../../utils/storageMigration') as {
  MIGRATION_FLAG_KEY: string;
  ensureMigrated: jest.Mock;
};

type ModeValue = { mode: string | null; setModeFilter: (m: string | null) => void };
type LanguageValue = { language: string | null; setLanguageFilter: (c: string | null) => void };
type HintsValue = { applyHints: (hints: { mode?: string | null; language?: string | null }) => void };

function ModeProbe({ onValue }: { onValue: (value: ModeValue) => void }) {
  onValue(useSessionModeFilter());
  return null;
}

function LanguageProbe({ onValue }: { onValue: (value: LanguageValue) => void }) {
  onValue(useSessionLanguageFilter());
  return null;
}

function HintsProbe({ onValue }: { onValue: (value: HintsValue) => void }) {
  onValue(useSessionFilterHints());
  return null;
}

function NoOpProbe() {
  useSessionModeFilter();
  useSessionLanguageFilter();
  useSessionFilterHints();
  return null;
}

async function flushPromises() {
  for (let i = 0; i < 12; i++) {
    await Promise.resolve();
  }
}

function mountProvider(children: React.ReactNode) {
  let renderer: ReturnType<typeof create> | null = null;

  act(() => {
    renderer = create(<SessionFilterProvider>{children}</SessionFilterProvider>);
  });

  return renderer as unknown as ReturnType<typeof create> & { unmount: () => void };
}

describe('SessionFilterContext', () => {
  let renderer: { unmount: () => void } | null = null;

  afterEach(async () => {
    if (renderer) {
      await act(async () => {
        renderer!.unmount();
      });
      renderer = null;
    }
    localStoreMock.__reset();
  });

  it('initializes synchronously from stored values on first render — no async flush needed', () => {
    localStoreMock.__store.set('sessionModeFilter', 'shape');
    localStoreMock.__store.set('sessionLanguageFilter', 'fr');

    let modeValue: ModeValue | null = null;
    let languageValue: LanguageValue | null = null;
    let probeRendered = false;

    renderer = mountProvider(
      <>
        <ModeProbe onValue={(value) => { modeValue = value; probeRendered = true; }} />
        <LanguageProbe onValue={(value) => { languageValue = value; }} />
      </>
    );

    expect(probeRendered).toBe(true);
    expect(modeValue).toEqual({ mode: 'shape', setModeFilter: expect.any(Function) });
    expect(languageValue).toEqual({ language: 'fr', setLanguageFilter: expect.any(Function) });
  });

  it('keeps null (never set) distinct from an explicit "any" round-trip', async () => {
    let modeValue: ModeValue | null = null;

    renderer = mountProvider(
      <ModeProbe onValue={(value) => { modeValue = value; }} />
    );

    expect(modeValue!.mode).toBeNull();
    expect(localStoreMock.__store.has('sessionModeFilter')).toBe(false);

    await act(async () => {
      modeValue!.setModeFilter('any');
    });

    expect(modeValue!.mode).toBe('any');
    expect(localStoreMock.__store.get('sessionModeFilter')).toBe('any');

    await act(async () => {
      modeValue!.setModeFilter('shape');
    });

    expect(modeValue!.mode).toBe('shape');
    expect(localStoreMock.__store.get('sessionModeFilter')).toBe('shape');
  });

  it('setters update state and persist through the storage savers', async () => {
    let modeValue: ModeValue | null = null;
    let languageValue: LanguageValue | null = null;

    renderer = mountProvider(
      <>
        <ModeProbe onValue={(value) => { modeValue = value; }} />
        <LanguageProbe onValue={(value) => { languageValue = value; }} />
      </>
    );

    await act(async () => {
      modeValue!.setModeFilter('point');
    });

    expect(modeValue!.mode).toBe('point');
    expect(localStoreMock.__store.get('sessionModeFilter')).toBe('point');

    await act(async () => {
      languageValue!.setLanguageFilter('de');
    });

    expect(languageValue!.language).toBe('de');
    expect(localStoreMock.__store.get('sessionLanguageFilter')).toBe('de');
  });

  it('applyHints sets present keys only, preserves never-set null, and never persists', async () => {
    localStoreMock.__store.set('sessionModeFilter', 'shape');

    let modeValue: ModeValue | null = null;
    let languageValue: LanguageValue | null = null;
    let hintsValue: HintsValue | null = null;
    let probeRenders = 0;

    renderer = mountProvider(
      <>
        <ModeProbe onValue={(value) => { modeValue = value; probeRenders += 1; }} />
        <LanguageProbe onValue={(value) => { languageValue = value; }} />
        <HintsProbe onValue={(value) => { hintsValue = value; }} />
      </>
    );

    const rendersAfterMount = probeRenders;

    await act(async () => {
      hintsValue!.applyHints({ mode: 'any' });
    });

    expect(modeValue!.mode).toBe('any');
    expect(languageValue!.language).toBeNull();
    expect(localStoreMock.__store.get('sessionModeFilter')).toBe('shape');
    expect(localStoreMock.__store.has('sessionLanguageFilter')).toBe(false);

    await act(async () => {
      hintsValue!.applyHints({ mode: 'any', language: 'any' });
    });

    expect(languageValue!.language).toBeNull();

    await act(async () => {
      hintsValue!.applyHints({ language: 'fr' });
    });

    expect(languageValue!.language).toBe('fr');
    expect(localStoreMock.__store.has('sessionLanguageFilter')).toBe(false);

    await act(async () => {
      hintsValue!.applyHints({ mode: 'any' });
    });

    expect(probeRenders).toBe(rendersAfterMount + 2);
  });

  it('seeds the language from preferredLanguage when no session filter is stored', () => {
    localStoreMock.__store.set('preferredLanguage', 'de');

    let languageValue: LanguageValue | null = null;

    renderer = mountProvider(
      <LanguageProbe onValue={(value) => { languageValue = value; }} />
    );

    expect(languageValue!.language).toBe('de');
  });

  it('an explicit session language filter wins over preferredLanguage', () => {
    localStoreMock.__store.set('sessionLanguageFilter', 'fr');
    localStoreMock.__store.set('preferredLanguage', 'de');

    let languageValue: LanguageValue | null = null;

    renderer = mountProvider(
      <LanguageProbe onValue={(value) => { languageValue = value; }} />
    );

    expect(languageValue!.language).toBe('fr');
  });

  it('re-reads once after ensureMigrated when the migration flag is missing', async () => {
    localStoreMock.__store.delete(storageMigrationMock.MIGRATION_FLAG_KEY);
    localStoreMock.__store.set('sessionModeFilter', 'shape');
    localStoreMock.__store.set('sessionLanguageFilter', 'fr');
    localStoreMock.__store.set('preferredLanguage', 'de');

    let resolveMigration: (() => void) | null = null;
    storageMigrationMock.ensureMigrated.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveMigration = resolve;
        })
    );

    let modeValue: ModeValue | null = null;
    let languageValue: LanguageValue | null = null;

    renderer = mountProvider(
      <>
        <ModeProbe onValue={(value) => { modeValue = value; }} />
        <LanguageProbe onValue={(value) => { languageValue = value; }} />
      </>
    );

    expect(modeValue!.mode).toBeNull();
    expect(languageValue!.language).toBeNull();
    expect(storageMigrationMock.ensureMigrated).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveMigration!();
      await flushPromises();
    });

    expect(modeValue!.mode).toBe('shape');
    expect(languageValue!.language).toBe('fr');
    expect(storageMigrationMock.ensureMigrated).toHaveBeenCalledTimes(1);
  });

  it('a selection made during the migration window wins over the post-migration re-read', async () => {
    localStoreMock.__store.delete(storageMigrationMock.MIGRATION_FLAG_KEY);

    let resolveMigration: (() => void) | null = null;
    storageMigrationMock.ensureMigrated.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveMigration = resolve;
        })
    );

    let modeValue: ModeValue | null = null;

    renderer = mountProvider(
      <ModeProbe onValue={(value) => { modeValue = value; }} />
    );

    expect(modeValue!.mode).toBeNull();

    await act(async () => {
      modeValue!.setModeFilter('point');
    });
    expect(modeValue!.mode).toBe('point');

    await act(async () => {
      localStoreMock.__store.set('sessionModeFilter', 'shape');
      resolveMigration!();
      await flushPromises();
    });

    expect(modeValue!.mode).toBe('point');
    expect(localStoreMock.__store.get('sessionModeFilter')).toBe('shape');
  });

  it('a hint applied during the migration window wins over the post-migration re-read', async () => {
    localStoreMock.__store.delete(storageMigrationMock.MIGRATION_FLAG_KEY);

    let resolveMigration: (() => void) | null = null;
    storageMigrationMock.ensureMigrated.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveMigration = resolve;
        })
    );

    let modeValue: ModeValue | null = null;
    let hintsValue: HintsValue | null = null;

    renderer = mountProvider(
      <>
        <ModeProbe onValue={(value) => { modeValue = value; }} />
        <HintsProbe onValue={(value) => { hintsValue = value; }} />
      </>
    );

    expect(modeValue!.mode).toBeNull();

    await act(async () => {
      hintsValue!.applyHints({ mode: 'point' });
      await flushPromises();
    });
    expect(modeValue!.mode).toBe('point');

    await act(async () => {
      localStoreMock.__store.set('sessionModeFilter', 'shape');
      resolveMigration!();
      await flushPromises();
    });

    expect(modeValue!.mode).toBe('point');
  });

  it('resolves provider-less defaults without throwing (never-set, no-op setters)', async () => {
    let rendererless: ReturnType<typeof create> | null = null;

    expect(() => {
      act(() => {
        rendererless = create(<NoOpProbe />);
      });
    }).not.toThrow();

    localStoreMock.__store.set('sessionModeFilter', 'shape');

    let modeValue: ModeValue | null = null;
    let languageValue: LanguageValue | null = null;

    act(() => {
      rendererless = create(
        <>
          <ModeProbe onValue={(value) => { modeValue = value; }} />
          <LanguageProbe onValue={(value) => { languageValue = value; }} />
        </>
      );
    });

    expect(modeValue!.mode).toBeNull();
    expect(languageValue!.language).toBeNull();

    expect(() => {
      modeValue!.setModeFilter('point');
      languageValue!.setLanguageFilter('fr');
    }).not.toThrow();

    expect(modeValue!.mode).toBeNull();
    expect(languageValue!.language).toBeNull();
    expect(localStoreMock.__store.get('sessionModeFilter')).toBe('shape');
    expect(localStoreMock.__store.has('sessionLanguageFilter')).toBe(false);

    await act(async () => {
      rendererless!.unmount();
    });
  });
});
