import { useContext, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';

import Button from '../../components/UI/Button';
import { GlobalStyle } from '../../constants/theme';
import { AuthContext } from '../../store/auth-context';
import { joinByCode } from '../../services/groups/groupJoinApi';
import { useActiveGroup } from '../../hooks/useActiveGroup';

export default function JoinByCodeScreen({ navigation }) {
  const authContext = useContext(AuthContext);
  const { setActive } = useActiveGroup();
  const [code, setCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    setErrorMessage('');
    const trimmed = code.trim();
    if (!trimmed) {
      setErrorMessage('Please enter a code.');
      return;
    }

    setIsSubmitting(true);
    const response = await joinByCode(authContext, trimmed);
    setIsSubmitting(false);

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
      setErrorMessage('Too many attempts — wait a minute.');
      return;
    }

    if (status === 422) {
      const reason = response?.data?.error || response?.data?.reason;
      if (reason === 'locked' || reason === 'group_locked') {
        setErrorMessage('Group is locked.');
      } else if (reason === 'unknown_code') {
        setErrorMessage('Unknown code.');
      } else if (reason === 'already_member') {
        setErrorMessage('You are already in this group.');
      } else {
        setErrorMessage('Group is full.');
      }
      return;
    }

    setErrorMessage('Could not join. Please try again.');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Enter the joining code</Text>
      <TextInput
        accessibilityLabel="Joining code"
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
        accessibilityLabel="Join group submit"
        onPress={submit}
        style={styles.button}
        testID="join-code.button.submit"
      >
        Join
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: GlobalStyle.color.primaryColor900, padding: 20 },
  label: { color: '#fff', fontSize: 18, marginTop: 12 },
  input: { backgroundColor: '#fff', color: '#000', padding: 10, marginTop: 4, borderRadius: 4 },
  errorText: { color: GlobalStyle.color.error500, fontSize: 14, marginTop: 8 },
  button: { marginTop: 24, backgroundColor: GlobalStyle.color.primaryColor100 },
});
