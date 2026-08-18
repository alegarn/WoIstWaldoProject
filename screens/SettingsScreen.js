import { useContext, useLayoutEffect, useState } from 'react';
import { View, Text, Alert, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import Button from '../components/UI/Button';
import Input from '../components/Auth/Input';
import LanguageSelector from '../components/UI/LanguageSelector';
import SettingsSection from '../components/Groups/Settings/SettingsSection';
import { settingsTokens } from '../components/Groups/Settings/settingsTokens';
import { GlobalStyle } from '../constants/theme';
import { updateUser, deleteAccount } from '../utils/auth';
import { AuthContext } from '../store/auth-context';
import { checkSecureStoreItem } from '../utils/auth';
import { getPreferredLanguage, savePreferredLanguage } from '../utils/storageDatum';
import { resolveDefaultLanguage } from '../utils/languageDefaults';
import CenteredModal from '../components/UI/CenteredModal';
import LoadingOverlay from '../components/UI/LoadingOverlay';

const SettingsScreen = ({ navigation }) => {

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('');
  // UI states __________________________________________________________________
  const [isLoading, setIsLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [selectedOption, setSelectedOption] = useState(null);

  const context = useContext(AuthContext);

  // Fetch email and username from secure storage__________________________________

  const getEmail = async () => {

    // combine with the context
    const email = await checkSecureStoreItem({
      secureStoreValue: 'email',
      context
    })
    // returns object
    console.log("email", email);
    console.log("email", typeof email);
    return email;
  };

  // Fetch username_______________________________________________________________
  const getUserName = async () => {
    // combine with the context
    const username = await checkSecureStoreItem({
      secureStoreValue: 'username',
      context
    })
    return username;
  };

  // useEffect to fetch email and username_________________________________________
  useLayoutEffect(() => {
    let mounted = true;
    Promise.all([
      getEmail(),
      getUserName(),
      getPreferredLanguage(),
    ]).then(([emailValue, usernameValue, languageValue]) => {
      if (!mounted) return;
      setEmail(emailValue);
      setUsername(usernameValue);
      setPreferredLanguage(languageValue || resolveDefaultLanguage());
    });
    return () => { mounted = false; };
  }, []);

  // Setting functions____________________________________________________________

  const handleChangeEmail = async () => {
    const data = {
      'email': email,
    };

    const response = await updateUser({ context, data });
    console.log("handleChangeEmail setting response", response?.status);
    console.log("email", response?.data?.email);

    if (response?.status === 200) {
      await context.changeUserEmail(response?.data?.email);
      Alert.alert('Email changed successfully!', `Your new email is: ${response?.data?.email}`);
      console.log("setting response", response?.status);
      return;
    }

    Alert.alert(`Error status code: ${response?.status}`, `There is an an error: ${response?.data}.`);
    console.log("setting response", response?.status);
  };

  const handleChangeUsername = async () => {
    const data = {
      'username': username,
    };

    const response = await updateUser({ context, data });
    console.log("handleChangeUsername setting response", response);

    if (response?.status === 200) {
      await context.changeUsername(response?.data?.username ?? username);
      Alert.alert('Username changed successfully!', `Your new username is ${response?.data?.username}`);
      return;
    }

    Alert.alert(`Error status code: ${response?.status}`,`There is an an error: ${response?.data}\n\nYou can retry later or your username is already taken.`);

  };

  const handleSelectPreferredLanguage = async (code) => {
    await savePreferredLanguage(code);
    setPreferredLanguage(code);
    Alert.alert(
      'Preferred language saved!',
      `Your preferred language for new enigmas is now: ${code}`
    );
  };

  const handleChangePassword = async () => {
    const data = {
      'current_password': oldPassword,
      'password': password,
      'password_confirmation': confirmPassword
    };

    const response = await updateUser({ context, data });
    console.log("handleChangePassword setting response", response?.status);

    response?.status === 200 &&
      Alert.alert('Password changed successfully!', 'Your new password is ready!');
      // weird error (success but error)
    response?.status !== 200 &&
      Alert.alert('Error', `${response?.data}`);
  };

  const handleDeleteAccount = async () => {
    const response = await deleteAccount({ context });
    console.log("handleDeleteAccount setting response", response?.status);

    if (response?.status === 200) {
      context.logout();
      Alert.alert(
        'Account deleted successfully!',
      `${response?.data?.message}\nWe are sorry to see you go!`
      );
    };

    response?.status !== 200
      && Alert.alert(`Error status code: ${response?.status}`, `There is an an error: ${response?.data}`);
    return null;
  };


  // Modal functions_____________________________________________________________

  const handleButtonClick = (option) => {
    setSelectedOption(option);
    switch (option) {
      case 'email':
        setConfirmMessage(`Are you sure you want to change your email to ${email} ?`);
        break;
      case 'username':
        setConfirmMessage(`Are you sure you want to change your username to ${username}?`);
        break;
      case 'password':
        setConfirmMessage('Are you sure you want to change your password?');
        break;
      case 'delete':
        setConfirmMessage(`!!! PERMANENT DELETION !!! \n\nAre you sure you want to delete your account?\n\n !!! PERMANENT DELETION !!!`);
        break;
      default:
        console.log('Invalid option selected');
        break;
    };
    setIsModalVisible(true);
  };

  const handleConfirm = async () => {
    setIsLoading(true);
    switch (selectedOption) {
      case 'email':
        await handleChangeEmail();
        break;
      case 'username':
        await handleChangeUsername();
        break;
      case 'password':
        await handleChangePassword();
        break;
      case 'delete':
        await handleDeleteAccount();
        break;
      default:
        console.log('Invalid option selected');
        break;
    };
    setIsLoading(false);
    setIsModalVisible(false);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };


  // LoadingOverlay functions ________________________________________________________
  const showLoadingOverlay = () => {
    const message = "Updating...";
    return <LoadingOverlay message={message} />;
  };

  if (isLoading) {
    return showLoadingOverlay();
  };

  if (!isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.screenBody} testID="settings.screen">
            <View style={styles.section}>
              <SettingsSection title="Change Email">
              <Input
                accessibilityLabel="Settings email"
                keyboardType="email-address"
                label="New email"
                onUpdateValue={setEmail}
                testID="settings.input.email"
                value={email}
              />
              <Button
                accessibilityLabel="Save email"
                onPress={() => handleButtonClick('email')}
                style={styles.button}
                testID="settings.button.save-email"
              >
                Save Email
              </Button>
              </SettingsSection>
            </View>

            <View style={styles.section}>
              <SettingsSection title="Change Username">
              <Input
                accessibilityLabel="Settings username"
                label="New username"
                onUpdateValue={setUsername}
                testID="settings.input.username"
                value={username}
              />
              <Button
                accessibilityLabel="Save username"
                onPress={() => handleButtonClick('username')}
                style={styles.button}
                testID="settings.button.save-username"
              >
                Save Username
              </Button>
              </SettingsSection>
            </View>

            <View style={styles.section}>
              <SettingsSection title="Change Password">
              <Input
                accessibilityLabel="Current password"
                label="Current password"
                onUpdateValue={setOldPassword}
                secure
                testID="settings.input.current-password"
                value={oldPassword}
              />
              <Input
                accessibilityLabel="New password"
                label="New password"
                onUpdateValue={setPassword}
                secure
                testID="settings.input.new-password"
                value={password}
              />
              <Input
                accessibilityLabel="Confirm new password"
                label="Confirm new password"
                onUpdateValue={setConfirmPassword}
                secure
                testID="settings.input.confirm-password"
                value={confirmPassword}
              />
              <Button
                accessibilityLabel="Save password"
                onPress={() => handleButtonClick('password')}
                style={styles.button}
                testID="settings.button.save-password"
              >
                Save Password
              </Button>
              </SettingsSection>
            </View>

            <View style={styles.section}>
              <SettingsSection
                title="Preferred Language"
              >
              <Text style={styles.languageCaption}>Preferred language (for new enigmas):</Text>
              <View testID="settings.input.preferred-language">
                <LanguageSelector
                  value={preferredLanguage}
                  onChange={handleSelectPreferredLanguage}
                  testIDPrefix="settings.input.preferred-language.selector"
                />
              </View>
              </SettingsSection>
            </View>

            <View style={styles.section}>
              <SettingsSection
                title="Subscription"
              >
              <Button
                accessibilityLabel="Open subscription management"
                onPress={() => navigation.navigate('SubscriptionManagementScreen')}
                style={styles.button}
                testID="settings.button.subscription"
              >
                Manage Subscription
              </Button>
              {(context?.paidTier ?? 0) < 3 && (
                <Button
                  accessibilityLabel="View plans"
                  mode="flat"
                  onPress={() => navigation.navigate('PaywallScreen', { intent: 'store' })}
                  style={styles.button}
                  testID="settings.button.view-plans"
                >
                  View plans
                </Button>
              )}
              </SettingsSection>
            </View>

            <View style={styles.dangerZoneContainer}>
              <Text style={styles.dangerZoneText}>Danger Zone</Text>
              <Text style={styles.dangerZoneCaption}>
                Deleting your account is permanent and cannot be undone.
              </Text>
              <Button
                accessibilityLabel="Delete account"
                cancel={true}
                onPress={() => handleButtonClick('delete')}
                style={styles.button}
                testID="settings.button.delete-account"
              >
                Delete Account
              </Button>
            </View>
          </View>
          <CenteredModal
            isModalVisible={isModalVisible}
            onPress={handleConfirm}
            onCancel={handleCancel}
            testIDPrefix="settings.confirm-modal"
            children={confirmMessage}
          />
        </ScrollView>
      </SafeAreaView>
    );
  };

};

export default SettingsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GlobalStyle.color.primaryColor900,
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 16,
  },
  screenBody: {
    paddingBottom: 16,
  },
  section: {
    marginBottom: 16,
  },
  languageCaption: {
    fontSize: 13,
    color: settingsTokens.muted,
    marginBottom: 8,
  },
  button: {
    alignSelf: 'stretch',
    marginTop: 8,
  },
  dangerZoneContainer: {
    padding: 12,
    borderRadius: settingsTokens.radiusPanel,
    borderWidth: 1,
    borderColor: settingsTokens.danger,
    backgroundColor: settingsTokens.dangerSoft,
  },
  dangerZoneText: {
    fontSize: 18,
    fontWeight: '700',
    color: settingsTokens.danger,
  },
  dangerZoneCaption: {
    fontSize: 13,
    color: settingsTokens.muted,
    marginTop: 2,
    marginBottom: 8,
  },
});
