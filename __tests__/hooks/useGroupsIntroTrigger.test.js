// shouldShowGroupsIntro RED suite (private-groups-intro-plan Task 4a).
//
// Pins the pure trigger-helper contract for the A-modal arms: the hard gates
// (kill-switch, chain quiet, seen flag, membership) must ALL pass and at
// least one trigger arm (completer triple / appOpenCount >= 2 / Home blur
// this session) must apply. Suite-level RED on module resolution until
// hooks/useGroupsIntroTrigger.ts lands in 4b.

import { shouldShowGroupsIntro } from '../../hooks/useGroupsIntroTrigger';

const BOOLEAN_KEYS = [
  'chainQuiet',
  'groupsIntroSeen',
  'hasAnyMembership',
  'enabled',
  'leftHomeThisSession',
  'completerTriple',
];

function* booleanCombinations(keys) {
  const total = 2 ** keys.length;
  for (let mask = 0; mask < total; mask += 1) {
    const combo = {};
    keys.forEach((key, index) => {
      combo[key] = Boolean((mask >> index) & 1);
    });
    yield combo;
  }
}

function expectedOutcome(gates) {
  if (!gates.enabled) return false;
  if (!gates.chainQuiet) return false;
  if (gates.groupsIntroSeen) return false;
  if (gates.hasAnyMembership) return false;
  return gates.completerTriple || gates.appOpenCount >= 2 || gates.leftHomeThisSession;
}

describe('shouldShowGroupsIntro', () => {
  it('fires only when every hard gate passes and at least one arm applies (all 128 gate combinations)', () => {
    for (const booleans of booleanCombinations(BOOLEAN_KEYS)) {
      for (const appOpenCount of [1, 2]) {
        const gates = { ...booleans, appOpenCount };
        expect(shouldShowGroupsIntro(gates)).toBe(expectedOutcome(gates));
      }
    }
  });

  it('fires on the completer arm alone with appOpenCount 1 and no Home blur', () => {
    expect(
      shouldShowGroupsIntro({
        chainQuiet: true,
        groupsIntroSeen: false,
        hasAnyMembership: false,
        enabled: true,
        leftHomeThisSession: false,
        completerTriple: true,
        appOpenCount: 1,
      })
    ).toBe(true);
  });

  it('fires on the app-open skipper arm without the completer triple', () => {
    expect(
      shouldShowGroupsIntro({
        chainQuiet: true,
        groupsIntroSeen: false,
        hasAnyMembership: false,
        enabled: true,
        leftHomeThisSession: false,
        completerTriple: false,
        appOpenCount: 2,
      })
    ).toBe(true);
  });

  it('fires on the blur arm with appOpenCount 1', () => {
    expect(
      shouldShowGroupsIntro({
        chainQuiet: true,
        groupsIntroSeen: false,
        hasAnyMembership: false,
        enabled: true,
        leftHomeThisSession: true,
        completerTriple: false,
        appOpenCount: 1,
      })
    ).toBe(true);
  });

  it('treats appOpenCount 1 as below the skipper threshold', () => {
    expect(
      shouldShowGroupsIntro({
        chainQuiet: true,
        groupsIntroSeen: false,
        hasAnyMembership: false,
        enabled: true,
        leftHomeThisSession: false,
        completerTriple: false,
        appOpenCount: 1,
      })
    ).toBe(false);
  });

  it('never fires when any hard gate fails regardless of the arms', () => {
    const hardGateFailures = [
      { chainQuiet: false, groupsIntroSeen: false, hasAnyMembership: false, enabled: true },
      { chainQuiet: true, groupsIntroSeen: true, hasAnyMembership: false, enabled: true },
      { chainQuiet: true, groupsIntroSeen: false, hasAnyMembership: true, enabled: true },
      { chainQuiet: true, groupsIntroSeen: false, hasAnyMembership: false, enabled: false },
    ];

    for (const gates of hardGateFailures) {
      expect(
        shouldShowGroupsIntro({
          ...gates,
          completerTriple: true,
          appOpenCount: 2,
          leftHomeThisSession: true,
        })
      ).toBe(false);
    }
  });
});
