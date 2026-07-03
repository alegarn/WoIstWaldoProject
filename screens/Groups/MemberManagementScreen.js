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
import {
  listMembers,
  removeMember,
  transferOwnership,
} from '../../services/groups/groupMembershipApi';

export default function MemberManagementScreen() {
  const authContext = useContext(AuthContext);
  const { scope } = useActiveGroup();
  const { data, refresh } = useGroupsHub();

  const groupId = scope?.kind === 'private' ? scope.groupId : null;
  const groups = [...(data?.owned ?? []), ...(data?.joined ?? [])];
  const group = groups.find((g) => g.id === groupId) ?? null;
  const isOwner = group?.role === 'owner';

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
      Alert.alert(`Error ${response?.status ?? ''}`, 'Could not transfer ownership.');
    }
  };

  if (isLoading && members.length === 0) {
    return <LoadingOverlay message="Loading members..." />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={members}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={<Text style={styles.empty}>No members.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.info}>
              <Text style={styles.username}>{item.username ?? item.user_id ?? 'Member'}</Text>
              {item.role === 'owner' && <Text style={styles.role}>Owner</Text>}
            </View>
            {isOwner && item.role !== 'owner' && (
              <View style={styles.actions}>
                <Button
                  cancel
                  disabled={isWorking}
                  onPress={() => setRemoveTarget(item)}
                  testID="member-mgmt.button.remove"
                >
                  Remove
                </Button>
                <Button
                  disabled={isWorking}
                  onPress={() => setTransferTarget(item)}
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
  container: { flex: 1, backgroundColor: GlobalStyle.color.primaryColor900, padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: GlobalStyle.color.primaryColor800, borderRadius: 8, marginVertical: 6 },
  info: { flex: 1 },
  username: { color: '#fff', fontSize: 16, fontWeight: '600' },
  role: { color: '#ffd700', fontSize: 12 },
  actions: { flexDirection: 'row', gap: 8 },
  empty: { color: '#fff', textAlign: 'center', marginTop: 20 },
});
