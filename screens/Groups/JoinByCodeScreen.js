import { useContext, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import Button from '../../components/UI/Button';
import { GlobalStyle } from '../../constants/theme';
import { AuthContext } from '../../store/auth-context';
import { joinByCode } from '../../services/groups/groupJoinApi';
import { useActiveGroup } from '../../hooks/useActiveGroup';

export default function JoinByCodeScreen({ navigation }) {
  const { t } = useTranslation();
  const authContext = useContext(AuthContext);
  const { setActive } = useActiveGroup();
  const [code, setCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    setErrorMessage('');
    const trimmed = code.trim();
    if (!trimmed) {
      setErrorMessage(t('groups.join.enterCodeError'));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await joinByCode(authContext, trimmed);

      const status = response?.status;
      if (status === 200 || status === 201) {
        const groupId = response?.data?.group_id ?? response?.data?.id;
        if (groupId) {
          await setActive(groupId);
          navigation.replace('PrivateHomeScreen', {
            scope: { kind: 'private', groupId },
          });
        } else {
          navigation.navigate('GroupsListScreen');
        }
        return;
      }

      if (status === 429) {
        setErrorMessage(t('groups.join.tooManyAttempts'));
        return;
      }

      if (status === 422) {
        const reason = response?.data?.error || response?.data?.reason;
        if (reason === 'locked' || reason === 'group_locked') {
          setErrorMessage(t('groups.join.locked'));
        } else if (reason === 'unknown_code') {
          setErrorMessage(t('groups.join.unknownCode'));
        } else if (reason === 'already_member') {
          setErrorMessage(t('groups.join.alreadyMember'));
        } else {
          setErrorMessage(t('groups.join.full'));
        }
        return;
      }

      setErrorMessage(t('groups.join.failed'));
    } catch (err) {
      setErrorMessage(err?.message ?? t('groups.join.failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t('groups.join.enterCode')}</Text>
      <TextInput
        accessibilityLabel={t('groups.join.codeLabel')}
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        style={styles.input}
        testID="join-code.input.code"
      />
      {errorMessage.length > 0 && (
        <Text style={styles.errorText} testID="join-code.error">
          {errorMessage}
        </Text>
      )}
      <Button
        accessibilityLabel={t('groups.join.submitLabel')}
        onPress={submit}
        style={styles.button}
        testID="join-code.button.submit"
      >
        {t('groups.join.join')}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: GlobalStyle.color.primaryColor900, padding: 20 },
  label: { color: '#fff', fontSize: 18, marginTop: 12 },
  input: { backgroundColor: '#fff', color: '#000', padding: 10, marginTop: 4, borderRadius: 4 },
  errorText: { color: GlobalStyle.color.error500, fontSize: 14, marginTop: 8 },
  button: { marginTop: 24, backgroundColor: GlobalStyle.color.primaryColor100, alignSelf: 'center' },
});
