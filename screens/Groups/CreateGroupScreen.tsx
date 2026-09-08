import { useContext, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import _BigButton from '../../components/UI/BigButton';
import _Button from '../../components/UI/Button';
import CenteredModal from '../../components/UI/CenteredModal';
import _ColorPalettePicker from '../../components/UI/ColorPalettePicker';
import LoadingOverlay from '../../components/UI/LoadingOverlay';
import { GlobalStyle } from '../../constants/theme';
import { AuthContext } from '../../store/auth-context';
import { useGroupsHub } from '../../hooks/useGroupsHub';
import { useActiveGroup } from '../../hooks/useActiveGroup';
import { createGroup } from '../../services/groups/groupApi';
import type { GroupScope, GroupsHubData } from '../../types/groups';

// BigButton.js, Button.js and ColorPalettePicker.js are unmigrated; their
// destructured props are inferred as required by TS. Permissive casts mirror
// the App.tsx convention.
const BigButton = _BigButton as React.ComponentType<any>;
const Button = _Button as React.ComponentType<any>;
const ColorPalettePicker = _ColorPalettePicker as React.ComponentType<any>;

type CreateGroupParamList = {
  CreateGroupScreen: Record<string, unknown>;
  PrivateHomeScreen: { scope?: GroupScope };
};

type CreateGroupScreenProps = {
  navigation: NativeStackNavigationProp<CreateGroupParamList, 'CreateGroupScreen'>;
};

export default function CreateGroupScreen({ navigation }: CreateGroupScreenProps) {
  const { t } = useTranslation();
  const authContext = useContext(AuthContext);
  const { data, isLoading } = useGroupsHub() as { data: GroupsHubData | null; isLoading: boolean };
  const { setActive } = useActiveGroup() as { setActive: (groupId: string | null) => Promise<unknown> };

  const [name, setName] = useState('');
  const [primaryColor, setPrimaryColor] = useState(GlobalStyle.color.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(GlobalStyle.color.secondaryColor);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);

  const owned = data?.owned ?? [];
  const alreadyOwns = owned.length > 0;

  if (isLoading && !data) {
    return <LoadingOverlay message={t('groups.create.loading')} />;
  }

  if (alreadyOwns) {
    const goToGroup = async () => {
      const groupId = owned[0]?.id;
      if (!groupId) return;
      await setActive(groupId);
      navigation.replace('PrivateHomeScreen', {
        scope: { kind: 'private', groupId },
      });
    };

    return (
      <View style={styles.lockedContainer}>
        <Text
          style={styles.lockedMessage}
          testID="create-group.message.already-owns"
        >
          {t('groups.create.onlyOne')}
        </Text>
        <BigButton
          text={t('groups.create.goToGroup')}
          onPress={goToGroup}
          testID="create-group.button.go-to-group"
          accessibilityLabel={t('groups.create.goToGroup')}
        />
      </View>
    );
  }

  const submit = () => {
    if (!name.trim()) {
      Alert.alert(t('groups.create.nameRequiredTitle'), t('groups.create.nameRequiredMessage'));
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

      Alert.alert(`${t('common.error')} ${response?.status ?? ''}`, t('groups.create.createFailed'));
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.message ?? t('groups.create.createFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitting) {
    return <LoadingOverlay message={t('groups.create.creating')} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t('groups.create.nameLabel')}</Text>
      <TextInput
        accessibilityLabel={t('groups.create.nameLabel')}
        value={name}
        onChangeText={setName}
        style={styles.input}
        testID="create-group.input.name"
      />

      <ColorPalettePicker
        label={t('groups.create.primaryColor')}
        value={primaryColor}
        onValueChange={setPrimaryColor}
        testIDPrefix="create-group.color-primary"
      />

      <ColorPalettePicker
        label={t('groups.create.secondaryColor')}
        value={secondaryColor}
        onValueChange={setSecondaryColor}
        testIDPrefix="create-group.color-secondary"
      />

      <Button
        accessibilityLabel={t('groups.create.submitLabel')}
        onPress={submit}
        style={styles.button}
        testID="create-group.button.submit"
      >
        {t('common.create')}
      </Button>

      <CenteredModal
        isModalVisible={isConfirmVisible}
        onPress={confirmCreate}
        onCancel={() => setIsConfirmVisible(false)}
        testIDPrefix="create-group.confirm"
        confirmTestID="create-group.confirm.ok"
        cancelTestID="create-group.confirm.cancel"
        confirmLabel={t('common.create')}
        cancelLabel={t('common.cancel')}
      >
        {t('groups.create.confirmMessage', { name: name.trim() })}
      </CenteredModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: GlobalStyle.color.primaryColor900, padding: 20 },
  lockedContainer: { flex: 1, backgroundColor: GlobalStyle.color.primaryColor900, padding: 20, alignItems: 'center', justifyContent: 'center' },
  lockedMessage: { color: GlobalStyle.color.win, fontSize: 18, textAlign: 'center', marginBottom: 20 },
  label: { color: '#fff', fontSize: 16, marginTop: 12 },
  input: { backgroundColor: '#fff', color: '#000', padding: 10, marginTop: 4, borderRadius: 4 },
  button: { marginTop: 24, backgroundColor: GlobalStyle.color.primaryColor100, alignSelf: 'center' },
});
