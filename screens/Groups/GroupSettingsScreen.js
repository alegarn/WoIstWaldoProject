import { useCallback, useEffect } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import LoadingOverlay from '../../components/UI/LoadingOverlay';
import { GlobalStyle } from '../../constants/theme';
import { useActiveGroup } from '../../hooks/useActiveGroup';
import { useGroupsHub } from '../../hooks/useGroupsHub';
import GroupMembersSection from '../../components/Groups/Settings/GroupMembersSection';
import GroupIdentitySection from '../../components/Groups/Settings/GroupIdentitySection';
import GroupCategoriesSection from '../../components/Groups/Settings/GroupCategoriesSection';
import { getPrivateGroupTheme } from '../../utils/privateGroupTheme';

/**
 * GroupSettingsScreen — thin orchestrator.
 *
 * Single Responsibility: resolve the active private group, gate ownership
 * (redirect non-owners), and compose the section components. Each section owns
 * its own data and mutations; this screen only wires shared dependencies
 * (groupId, group hub refresh) into them.
 */
export default function GroupSettingsScreen({ navigation }) {
  const { t } = useTranslation();
  const { scope } = useActiveGroup();
  const { data, isLoading, refresh } = useGroupsHub();

  const groupId = scope?.kind === 'private' ? scope.groupId : null;
  const groups = [...(data?.owned ?? []), ...(data?.joined ?? [])];
  const group = groups.find((g) => g.id === groupId) ?? null;
  const isOwner = group?.role === 'owner';
  const theme = getPrivateGroupTheme({
    primaryColor: group?.primary_color,
    secondaryColor: group?.secondary_color,
  });

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  useEffect(() => {
    if (!groupId) return;
    if (isLoading) return;
    if (isOwner) return;
    navigation.replace('GroupsListScreen');
  }, [groupId, isOwner, isLoading, navigation]);

  useEffect(() => {
    navigation?.setOptions?.({
      headerStyle: { backgroundColor: theme.primaryColor },
      headerTintColor: theme.headerTintColor,
    });
  }, [navigation, theme.headerTintColor, theme.primaryColor]);

  if (!groupId || isLoading || !isOwner) {
    return <LoadingOverlay message={t('groups.settings.checkingOwnership')} />;
  }

  return (
    <FlatList
      style={[styles.scroll, { backgroundColor: theme.screen }]}
      contentContainerStyle={styles.content}
      data={[]}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={(
        <View style={styles.stack}>
          <GroupMembersSection
            onManageMembers={() => navigation.navigate('MemberManagementScreen')}
            primaryColor={theme.primaryColor}
            secondaryColor={theme.secondaryColor}
          />

          <GroupIdentitySection
            groupId={groupId}
            initialName={group.name ?? ''}
            initialPrimaryColor={group.primary_color ?? GlobalStyle.color.primaryColor}
            initialSecondaryColor={group.secondary_color ?? GlobalStyle.color.secondaryColor}
            onRefresh={refresh}
          />
        </View>
      )}
      ListFooterComponent={(
        <GroupCategoriesSection
          groupId={groupId}
          onRefresh={refresh}
          primaryColor={theme.primaryColor}
          secondaryColor={theme.secondaryColor}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 20, gap: 12 },
  stack: { gap: 12 },
});
