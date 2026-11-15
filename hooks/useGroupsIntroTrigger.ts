import { useEffect, useRef } from 'react';

import { GROUPS_INTRO_ENABLED } from '../constants/featureFlags';
import {
  getAppOpenCount,
  getGroupsIntroSeen,
  setGroupsIntroSeen,
} from '../utils/storageDatum';

export type GroupsIntroGates = {
  chainQuiet: boolean;
  groupsIntroSeen: boolean;
  hasAnyMembership: boolean;
  enabled: boolean;
  leftHomeThisSession: boolean;
  completerTriple: boolean;
  appOpenCount: number;
};

type TutorialTriple = {
  isTutorial?: boolean | null;
  guessPathDone?: boolean | null;
  hidePathDone?: boolean | null;
};

export type GroupsIntroNavigation = {
  addListener: (event: string, listener: () => void) => () => void;
  navigate?: (name: string) => void;
};

type UseGroupsIntroTriggerArgs = {
  chainQuiet: boolean;
  context: { isTutorialFinished?: TutorialTriple | null };
  navigation?: GroupsIntroNavigation | undefined;
  getHasAnyMembership: () => boolean;
  hubReady: boolean;
  onShow: () => void;
};

export function shouldShowGroupsIntro(gates: GroupsIntroGates): boolean {
  if (!gates.enabled) return false;
  if (!gates.chainQuiet) return false;
  if (gates.groupsIntroSeen) return false;
  if (gates.hasAnyMembership) return false;
  return gates.completerTriple || gates.appOpenCount >= 2 || gates.leftHomeThisSession;
}

export function isCompleterTriple(
  isTutorialFinished: TutorialTriple | null | undefined
): boolean {
  return Boolean(
    isTutorialFinished?.isTutorial === true &&
      isTutorialFinished?.guessPathDone === true &&
      isTutorialFinished?.hidePathDone === true
  );
}

export default function useGroupsIntroTrigger({
  chainQuiet,
  context,
  navigation,
  getHasAnyMembership,
  hubReady,
  onShow,
}: UseGroupsIntroTriggerArgs): void {
  const groupsIntroShownRef = useRef(false);
  const leftHomeThisSessionRef = useRef(false);
  const argsRef = useRef<UseGroupsIntroTriggerArgs>({
    chainQuiet,
    context,
    navigation,
    getHasAnyMembership,
    hubReady,
    onShow,
  });
  argsRef.current = { chainQuiet, context, navigation, getHasAnyMembership, hubReady, onShow };

  const evaluateArmsRef = useRef(async () => {
    if (groupsIntroShownRef.current) return;
    if (!GROUPS_INTRO_ENABLED) return;
    const current = argsRef.current;
    // Not-ready gate: an unsettled hub must never drive a show decision.
    // Consume nothing (one-shot, leftHome flag) and write nothing here; the
    // re-evaluation effect re-runs when the hub settles.
    if (!current.hubReady) return;
    const leftHomeThisSession = leftHomeThisSessionRef.current;
    leftHomeThisSessionRef.current = false;
    if (!current.chainQuiet) return;

    const readOrFailOpen = async (read: () => Promise<unknown>) => {
      try {
        return await read();
      } catch {
        return undefined;
      }
    };
    const [seenFlag, openCount] = await Promise.all([
      readOrFailOpen(getGroupsIntroSeen),
      readOrFailOpen(getAppOpenCount),
    ]);

    if (groupsIntroShownRef.current) return;

    const fires = shouldShowGroupsIntro({
      chainQuiet: current.chainQuiet,
      enabled: GROUPS_INTRO_ENABLED,
      groupsIntroSeen: seenFlag === true,
      hasAnyMembership: current.getHasAnyMembership(),
      leftHomeThisSession,
      completerTriple: isCompleterTriple(current.context?.isTutorialFinished),
      appOpenCount: typeof openCount === 'number' ? openCount : 0,
    });

    if (!fires) return;
    groupsIntroShownRef.current = true;
    try {
      await setGroupsIntroSeen(true);
    } catch {
      // fail-open: a failed flag write must not block the sheet
    }
    current.onShow();
  });

  useEffect(() => {
    if (groupsIntroShownRef.current) return;
    if (!chainQuiet) return;
    void evaluateArmsRef.current();
  }, [chainQuiet, context.isTutorialFinished, hubReady]);

  useEffect(() => {
    const nav = argsRef.current.navigation;
    if (!nav?.addListener) return undefined;
    const unsubscribeBlur = nav.addListener('blur', () => {
      leftHomeThisSessionRef.current = true;
    });
    const unsubscribeFocus = nav.addListener('focus', () => {
      void evaluateArmsRef.current();
    });
    return () => {
      unsubscribeBlur();
      unsubscribeFocus();
    };
  }, []);
}
