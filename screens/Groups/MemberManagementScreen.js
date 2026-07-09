import { useCallback, useContext, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import Button from '../../components/UI/Button';
import CenteredModal from '../../components/UI/CenteredModal';
import LoadingOverlay from '../../components/UI/LoadingOverlay';
import { GlobalStyle } from '../../constants/theme';
import { AuthContext } from '../../store/auth-context';
import { useActiveGroup } from '../../hooks/useActiveGroup';
import { useGroupsHub } from '../../hooks/useGroupsHub';
import { getPrivateGroupTheme } from '../../utils/privateGroupTheme';
import {
  listMembers,
  removeMember,
  transferOwnership,
} from '../../services/groups/groupMembershipApi';

export function transferErrorMessageFor(response) {
  const reason = response?.data?.error;
  if (reason === 'recipient_not_creator') {
    return 'This member needs to hold a "Group Creator" tier before transfer to own the group.';
  }
  if (reason === 'recipient_not_member') {
    return 'This member is no longer in the group.';
  }
  return response?.data?.message ?? 'Could not transfer ownership. Please try again.';
}

export default function MemberManagementScreen({ navigation }) {
  const authContext = useContext(AuthContext);
  const { scope } = useActiveGroup();
  const { data, refresh } = useGroupsHub();

  const groupId = scope?.kind === 'private' ? scope.groupId : null;
  const groups = [...(data?.owned ?? []), ...(data?.joined ?? [])];
  const group = groups.find((g) => g.id === groupId) ?? null;
  const isOwner = group?.role === 'owner';
  const theme = getPrivateGroupTheme({
    primaryColor: group?.primary_color,
    secondaryColor: group?.secondary_color,
  });

  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [transferTarget, setTransferTarget] = useState(null);
  const [isWorking, setIsWorking] = useState(false);

  const loadMembers = useCallback(async () => {
    if (!groupId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const response = await listMembers({ context: authContext, groupId });
    setIsLoading(false);
    if (response?.status === 200) {
      setMembers(response.data ?? []);
    }
  }, [authContext, groupId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  useEffect(() => {
    navigation?.setOptions?.({
      headerStyle: { backgroundColor: theme.primaryColor },
      headerTintColor: theme.headerTintColor,
    });
  }, [navigation, theme.headerTintColor, theme.primaryColor]);

  if (!groupId) {
    return <LoadingOverlay message="Loading group..." />;
  }

  const confirmRemove = async () => {
    if (!removeTarget) return;
    setIsWorking(true);
    const response = await removeMember({
      context: authContext,
      groupId,
      membershipId: removeTarget.id,
      removedUserId: removeTarget.user_id ?? removeTarget.userId,
    });
    setIsWorking(false);
    setRemoveTarget(null);
    if (response?.status === 200 || response?.status === 204) {
      await loadMembers();
    } else {
      Alert.alert(`Error ${response?.status ?? ''}`, 'Could not remove member.');
    }
  };

  const confirmTransfer = async () => {
    if (!transferTarget) return;
    setIsWorking(true);
    const response = await transferOwnership({
      context: authContext,
      groupId,
      targetUserId: transferTarget.user_id ?? transferTarget.userId,
    });
    setIsWorking(false);
    setTransferTarget(null);
    if (response?.status === 200 || response?.status === 204) {
      await loadMembers();
      refresh();
    } else {
      Alert.alert('Cannot transfer ownership', transferErrorMessageFor(response));
    }
  };

  if (isLoading && members.length === 0) {
    return <LoadingOverlay message="Loading members..." />;
  }

  return (
    <View testID="member-mgmt.screen" style={[styles.container, { backgroundColor: theme.screen }] }>
      <FlatList
        data={members}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={<Text style={[styles.empty, { color: theme.text }]}>No members.</Text>}
        renderItem={({ item }) => (
          <View
            testID={`member-mgmt.row.${item.id}`}
            style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.hairline }] }
          >
            <View style={styles.info}>
              <Text style={[styles.username, { color: theme.text }]}>{item.username ?? item.user_id ?? 'Member'}</Text>
              {item.role === 'owner' && <Text style={[styles.role, { color: theme.warning }]}>Owner</Text>}
            </View>
            {isOwner && item.role !== 'owner' && (
              <View style={styles.actions}>
                <Button
                  disabled={isWorking}
                  onPress={() => setRemoveTarget(item)}
                  style={{ backgroundColor: theme.danger }}
                  textStyle={{ color: '#fff' }}
                  testID="member-mgmt.button.remove"
                >
                  Remove
                </Button>
                <Button
                  disabled={isWorking}
                  onPress={() => setTransferTarget(item)}
                  style={{ backgroundColor: theme.primaryColor }}
                  textStyle={{ color: theme.accentText }}
                  testID="member-mgmt.button.transfer"
                >
                  Transfer
                </Button>
              </View>
            )}
          </View>
        )}
      />

      <CenteredModal
        isModalVisible={!!removeTarget && !isWorking}
        onPress={confirmRemove}
        onCancel={() => setRemoveTarget(null)}
        testIDPrefix="members.remove.confirm"
        confirmTestID="members.remove.confirm.ok"
        cancelTestID="members.remove.confirm.cancel"
        confirmLabel="Remove"
        cancelLabel="Cancel"
      >
        {`Remove ${removeTarget?.username ?? 'this member'} from the group?`}
      </CenteredModal>

      <CenteredModal
        isModalVisible={!!transferTarget && !isWorking}
        onPress={confirmTransfer}
        onCancel={() => setTransferTarget(null)}
        testIDPrefix="members.transfer.confirm"
        confirmTestID="members.transfer.confirm.ok"
        cancelTestID="members.transfer.confirm.cancel"
        confirmLabel="Transfer"
        cancelLabel="Cancel"
      >
        {`Transfer ownership to ${transferTarget?.username ?? 'this member'}?`}
      </CenteredModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    marginVertical: 6,
    borderWidth: 1,
  },
  info: { flex: 1 },
  username: { fontSize: 16, fontWeight: '600' },
  role: { fontSize: 12 },
  actions: { flexDirection: 'row', gap: 8 },
  empty: { textAlign: 'center', marginTop: 20 },
});
