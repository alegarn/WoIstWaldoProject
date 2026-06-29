import { useContext, useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert } from 'react-native';

import Button from '../../components/UI/Button';
import CenteredModal from '../../components/UI/CenteredModal';
import LoadingOverlay from '../../components/UI/LoadingOverlay';
import { GlobalStyle } from '../../constants/theme';
import { AuthContext } from '../../store/auth-context';
import { useGroupsHub } from '../../hooks/useGroupsHub';
import { useActiveGroup } from '../../hooks/useActiveGroup';
import { createGroup } from '../../services/groups/groupApi';

export default function CreateGroupScreen({ navigation }) {
  const authContext = useContext(AuthContext);
  const { data } = useGroupsHub();
  const { setActive } = useActiveGroup();

  const [name, setName] = useState('');
  const [primaryColor, setPrimaryColor] = useState(GlobalStyle.color.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(GlobalStyle.color.secondaryColor);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);

  const owned = data?.owned ?? [];
  const canCreateGroup = (authContext?.premiumTier ?? 0) >= 2 && owned.length === 0;

  useEffect(() => {
    if (!canCreateGroup) {
      navigation.replace('PaywallScreen', { intent: 'create-group' });
    }
  }, [canCreateGroup, navigation]);

  if (!canCreateGroup) {
    return <LoadingOverlay message="Checking entitlement..." />;
  }

  const submit = () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a group name.');
      return;
    }
    setIsConfirmVisible(true);
  };

  const confirmCreate = async () => {
    setIsConfirmVisible(false);
    setIsSubmitting(true);

    try {
      const response = await createGroup(authContext, {
        name: name.trim(),
        primaryColor,
        secondaryColor,
      });

      if (response?.status === 200 || response?.status === 201) {
        const newGroup = response?.data;
        const groupId = newGroup?.id ?? newGroup?.private_group?.id;
        if (groupId) {
          await setActive(groupId);
        }
        navigation.replace('PrivateHomeScreen', {
          scope: { kind: 'private', groupId },
        });
        return;
      }

      Alert.alert(`Error ${response?.status ?? ''}`, 'Could not create the group. Please try again.');
    } catch (err) {
      Alert.alert('Error', err?.message ?? 'Could not create the group. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitting) {
    return <LoadingOverlay message="Creating group..." />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Group name</Text>
      <TextInput
        accessibilityLabel="Group name"
        value={name}
        onChangeText={setName}
        style={styles.input}
        testID="create-group.input.name"
      />

      <Text style={styles.label}>Primary color</Text>
      <TextInput
        accessibilityLabel="Primary color"
        value={primaryColor}
        onChangeText={setPrimaryColor}
        style={styles.input}
        testID="create-group.input.color-primary"
      />

      <Text style={styles.label}>Secondary color</Text>
      <TextInput
        accessibilityLabel="Secondary color"
        value={secondaryColor}
        onChangeText={setSecondaryColor}
        style={styles.input}
        testID="create-group.input.color-secondary"
      />

      <Button
        accessibilityLabel="Create group submit"
        onPress={submit}
        style={styles.button}
        testID="create-group.button.submit"
      >
        Create
      </Button>

      <CenteredModal
        isModalVisible={isConfirmVisible}
        onPress={confirmCreate}
        onCancel={() => setIsConfirmVisible(false)}
        testIDPrefix="create-group.confirm"
        confirmTestID="create-group.confirm.ok"
        cancelTestID="create-group.confirm.cancel"
        confirmLabel="Create"
        cancelLabel="Cancel"
      >
        {`Create group "${name.trim()}"?`}
      </CenteredModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: GlobalStyle.color.primaryColor900, padding: 20 },
  label: { color: '#fff', fontSize: 16, marginTop: 12 },
  input: { backgroundColor: '#fff', color: '#000', padding: 10, marginTop: 4, borderRadius: 4 },
  button: { marginTop: 24, backgroundColor: GlobalStyle.color.primaryColor100 },
});
