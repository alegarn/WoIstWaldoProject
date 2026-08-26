import { useContext, useLayoutEffect, useState } from 'react';
import { View, Text, Alert, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import Button from '../components/UI/Button';
import Input from '../components/Auth/Input';
import LanguageSelector from '../components/UI/LanguageSelector';
import SettingsSection from '../components/Groups/Settings/SettingsSection';
import { settingsTokens } from '../components/Groups/Settings/settingsTokens';
import { GlobalStyle } from '../constants/theme';
import { updateUser, deleteAccount } from '../utils/auth';
import { AuthContext } from '../store/auth-context';
import { useUiLocale } from '../store/i18n-context';
import { checkSecureStoreItem } from '../utils/auth';
import { getPreferredLanguage, savePreferredLanguage, wipePublicGuessStorage } from '../utils/storageDatum';
import { resetServingCycles } from '../utils/servingCycle';
import { resolveDefaultLanguage } from '../utils/languageDefaults';
import CenteredModal from '../components/UI/CenteredModal';
import LoadingOverlay from '../components/UI/LoadingOverlay';

const SettingsScreen = ({ navigation }) => {

  const { t } = useTranslation();
  const { uiLocale, setUiLocale } = useUiLocale();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('');
  // UI states __________________________________________________________________
  const [isLoading, setIsLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState(null);
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
    navigation?.setOptions({ title: t('settings.title') });
  }, [navigation, t]);

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
      Alert.alert(t('settings.emailChangedTitle'), t('settings.emailChangedMessage', { email: response?.data?.email }));
      console.log("setting response", response?.status);
      return;
    }

    Alert.alert(t('settings.updateErrorTitle', { status: response?.status }), t('settings.emailErrorMessage', { data: String(response?.data) }));
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
      Alert.alert(t('settings.usernameChangedTitle'), t('settings.usernameChangedMessage', { username: response?.data?.username }));
      return;
    }

    Alert.alert(t('settings.updateErrorTitle', { status: response?.status }), t('settings.usernameErrorMessage', { data: String(response?.data) }));

  };

  const handleSelectPreferredLanguage = async (code) => {
    await savePreferredLanguage(code);
    setPreferredLanguage(code);
    Alert.alert(
      t('settings.preferredSavedTitle'),
      t('settings.preferredSavedMessage', { code })
    );
  };

  const devResetGuessServing = async () => {
    try {
      await wipePublicGuessStorage();
      await resetServingCycles();
      Alert.alert(
        'Guess serving reset',
        'Serving state cleared. Return to the category list and start fresh.'
      );
    } catch (error) {
      Alert.alert('Reset failed', `${error?.message ?? 'Unknown error'}`);
    }
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
      Alert.alert(t('settings.passwordChangedTitle'), t('settings.passwordChangedMessage'));
      // weird error (success but error)
    response?.status !== 200 &&
      Alert.alert(t('common.error'), t('settings.errorMessage', { data: String(response?.data) }));
  };

  const handleDeleteAccount = async () => {
    const response = await deleteAccount({ context });
    console.log("handleDeleteAccount setting response", response?.status);

    if (response?.status === 200) {
      context.logout();
      Alert.alert(
        t('settings.accountDeletedTitle'),
      t('settings.accountDeletedMessage', { message: response?.data?.message })
      );
    };

    response?.status !== 200
      && Alert.alert(t('settings.updateErrorTitle', { status: response?.status }), t('settings.accountErrorMessage', { data: String(response?.data) }));
    return null;
  };


  // Modal functions_____________________________________________________________

  const handleButtonClick = (option) => {
    setSelectedOption(option);
    switch (option) {
      case 'email':
        setConfirmMessage({ key: 'settings.confirmEmailChange', params: { email } });
        break;
      case 'username':
        setConfirmMessage({ key: 'settings.confirmUsernameChange', params: { username } });
        break;
      case 'password':
        setConfirmMessage({ key: 'settings.confirmPasswordChange' });
        break;
      case 'delete':
        setConfirmMessage({ key: 'settings.confirmDelete' });
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
    const message = t('settings.updating');
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
              <SettingsSection title={t('settings.changeEmail')}>
              <Input
                accessibilityLabel={t('settings.settingsEmailLabel')}
                keyboardType="email-address"
                label={t('settings.newEmail')}
                onUpdateValue={setEmail}
                testID="settings.input.email"
                value={email}
              />
              <Button
                accessibilityLabel={t('settings.saveEmailLabel')}
                onPress={() => handleButtonClick('email')}
                style={styles.button}
                testID="settings.button.save-email"
              >
                {t('settings.saveEmail')}
              </Button>
              </SettingsSection>
            </View>

            <View style={styles.section}>
              <SettingsSection title={t('settings.changeUsername')}>
              <Input
                accessibilityLabel={t('settings.settingsUsernameLabel')}
                label={t('settings.newUsername')}
                onUpdateValue={setUsername}
                testID="settings.input.username"
                value={username}
              />
              <Button
                accessibilityLabel={t('settings.saveUsernameLabel')}
                onPress={() => handleButtonClick('username')}
                style={styles.button}
                testID="settings.button.save-username"
              >
                {t('settings.saveUsername')}
              </Button>
              </SettingsSection>
            </View>

            <View style={styles.section}>
              <SettingsSection title={t('settings.changePassword')}>
              <Input
                accessibilityLabel={t('settings.currentPassword')}
                label={t('settings.currentPassword')}
                onUpdateValue={setOldPassword}
                secure
                testID="settings.input.current-password"
                value={oldPassword}
              />
              <Input
                accessibilityLabel={t('settings.newPassword')}
                label={t('settings.newPassword')}
                onUpdateValue={setPassword}
                secure
                testID="settings.input.new-password"
                value={password}
              />
              <Input
                accessibilityLabel={t('settings.confirmNewPassword')}
                label={t('settings.confirmNewPassword')}
                onUpdateValue={setConfirmPassword}
                secure
                testID="settings.input.confirm-password"
                value={confirmPassword}
              />
              <Button
                accessibilityLabel={t('settings.savePasswordLabel')}
                onPress={() => handleButtonClick('password')}
                style={styles.button}
                testID="settings.button.save-password"
              >
                {t('settings.savePassword')}
              </Button>
              </SettingsSection>
            </View>

            <View style={styles.section}>
              <SettingsSection
                title={t('settings.preferredLanguage')}
              >
              <Text style={styles.languageCaption}>{t('settings.preferredLanguageCaption')}</Text>
              <View testID="settings.input.preferred-language">
                <LanguageSelector
                  value={preferredLanguage}
                  onChange={handleSelectPreferredLanguage}
                  accessibilityLabel={t('settings.preferredLanguageLabel')}
                  accessibilityHint={t('settings.preferredLanguageHint')}
                  testIDPrefix="settings.input.preferred-language.selector"
                />
              </View>
              </SettingsSection>
            </View>

            <View style={styles.section}>
              <SettingsSection
                title={t('settings.appLanguage')}
              >
              <Text style={styles.languageCaption}>{t('settings.appLanguageCaption')}</Text>
              <View testID="settings.input.ui-locale">
                <LanguageSelector
                  value={uiLocale}
                  onChange={setUiLocale}
                  accessibilityLabel={t('settings.appLanguageLabel')}
                  accessibilityHint={t('settings.appLanguageHint')}
                  testIDPrefix="settings.input.ui-locale.selector"
                />
              </View>
              </SettingsSection>
            </View>

            <View style={styles.section}>
              <SettingsSection
                title={t('settings.subscription')}
              >
              <Button
                accessibilityLabel={t('settings.manageSubscriptionLabel')}
                onPress={() => navigation.navigate('SubscriptionManagementScreen')}
                style={styles.button}
                testID="settings.button.subscription"
              >
                {t('settings.manageSubscription')}
              </Button>
              {(context?.paidTier ?? 0) < 3 && (
                <Button
                  accessibilityLabel={t('settings.viewPlans')}
                  mode="flat"
                  onPress={() => navigation.navigate('PaywallScreen', { intent: 'store' })}
                  style={styles.button}
                  testID="settings.button.view-plans"
                >
                  {t('settings.viewPlans')}
                </Button>
              )}
              </SettingsSection>
            </View>

            {__DEV__ && (
              <View style={styles.section}>
                <SettingsSection title="Developer">
                  <Button
                    accessibilityLabel="Reset guess serving (dev)"
                    onPress={() => devResetGuessServing()}
                    style={styles.button}
                    testID="settings.button.reset-guess-serving"
                  >
                    Reset guess serving (dev)
                  </Button>
                </SettingsSection>
              </View>
            )}

            <View style={styles.dangerZoneContainer}>
              <Text style={styles.dangerZoneText}>{t('settings.dangerZone')}</Text>
              <Text style={styles.dangerZoneCaption}>
                {t('settings.dangerZoneCaption')}
              </Text>
              <Button
                accessibilityLabel={t('settings.deleteAccountLabel')}
                cancel={true}
                onPress={() => handleButtonClick('delete')}
                style={styles.button}
                testID="settings.button.delete-account"
              >
                {t('settings.deleteAccount')}
              </Button>
            </View>
          </View>
          <CenteredModal
            isModalVisible={isModalVisible}
            onPress={handleConfirm}
            onCancel={handleCancel}
            testIDPrefix="settings.confirm-modal"
            children={confirmMessage ? t(confirmMessage.key, confirmMessage.params) : ''}
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
