import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { NavigationContext } from '@react-navigation/native';

import { AuthContext } from '../../store/auth-context';
import { useGroupsHub } from '../../hooks/useGroupsHub';
import useGroupsIntroTrigger, {
  GroupsIntroNavigation,
} from '../../hooks/useGroupsIntroTrigger';
import GroupsIntroSheet from '../UI/GroupsIntroSheet';
import { markIntroShownThisSession } from '../../screens/Groups/groupsIntroSession';
import {
  setGroupsDetailSeen,
  setGroupsIntroSeen,
} from '../../utils/storageDatum';
import {
  getUiState,
  publish,
  subscribe,
} from '../../utils/groupsIntro/groupsIntroUiStore';
import type { GroupsIntroUiState } from '../../utils/groupsIntro/groupsIntroUiStore';
import type { GroupsHubData } from '../../types/groups';

type GroupsIntroGateProps = {
  chainQuiet: boolean;
  navigation?: GroupsIntroNavigation;
};

export function hasAnyGroupMembership(data: GroupsHubData | null | undefined): boolean {
  return (data?.owned?.length ?? 0) + (data?.joined?.length ?? 0) > 0;
}

export default function GroupsIntroGate({
  chainQuiet,
  navigation: navigationProp,
}: GroupsIntroGateProps) {
  const contextNavigation = useContext(NavigationContext);
  const navigation: GroupsIntroNavigation | undefined =
    navigationProp ?? (contextNavigation as GroupsIntroNavigation | undefined);
  const context = useContext(AuthContext);
  const { data, isLoading } = useGroupsHub();

  const [sheetVisible, setSheetVisible] = useState(false);

  const hubDataRef = useRef(data);
  hubDataRef.current = data;
  const sheetVisibleRef = useRef(sheetVisible);
  sheetVisibleRef.current = sheetVisible;
  const lastTapCountRef = useRef(getUiState().tapCount);
  const membershipWrittenRef = useRef(false);

  const navigateToGroupsList = useCallback(() => {
    navigation?.navigate?.('GroupsListScreen');
  }, [navigation]);

  const dismissSheet = useCallback(() => {
    setSheetVisible(false);
    if (getUiState().ringPhase === 'active') {
      publish({ ringPhase: 'settle' });
    }
  }, []);

  const handleOpen = useCallback(() => {
    dismissSheet();
    navigateToGroupsList();
  }, [dismissSheet, navigateToGroupsList]);

  const handleUiState = useCallback((state: GroupsIntroUiState) => {
    if (state.tapCount === lastTapCountRef.current) return;
    lastTapCountRef.current = state.tapCount;
    if (sheetVisibleRef.current) {
      dismissSheet();
    }
  }, [dismissSheet]);

  const handleUiStateRef = useRef(handleUiState);
  handleUiStateRef.current = handleUiState;

  const handleIntroShown = useCallback(() => {
    markIntroShownThisSession();
    publish({ ringPhase: 'active' });
    setSheetVisible(true);
  }, []);

  useGroupsIntroTrigger({
    chainQuiet,
    context,
    navigation,
    getHasAnyMembership: () => hasAnyGroupMembership(hubDataRef.current),
    hubReady: data != null && !isLoading,
    onShow: handleIntroShown,
  });

  useEffect(() => {
    if (getUiState().ringPhase !== 'off') {
      publish({ ringPhase: 'off' });
    }
    lastTapCountRef.current = getUiState().tapCount;
    const unsubscribe = subscribe((state) => handleUiStateRef.current(state));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (membershipWrittenRef.current) return;
    if (isLoading || data == null) return;
    if (!hasAnyGroupMembership(data)) return;
    membershipWrittenRef.current = true;
    setGroupsIntroSeen(true).catch(() => {});
    setGroupsDetailSeen(true).catch(() => {});
  }, [data, isLoading]);

  if (!sheetVisible) return null;

  return (
    <GroupsIntroSheet
      visible={sheetVisible}
      onOpen={handleOpen}
      onLater={dismissSheet}
    />
  );
}
