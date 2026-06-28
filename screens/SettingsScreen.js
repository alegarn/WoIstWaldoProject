import { useContext, useEffect, useLayoutEffect, useState } from 'react';
import { View, Text, TextInput, Alert, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import Button from '../components/UI/Button';
import LanguageSelector from '../components/UI/LanguageSelector';
import { GlobalStyle } from '../constants/theme';
import { updateUser, deleteAccount } from '../utils/auth';
import { AuthContext } from '../store/auth-context';
import { checkSecureStoreItem } from '../utils/auth';
import { getPreferredLanguage, savePreferredLanguage } from '../utils/storageDatum';
import { resolveDefaultLanguage } from '../utils/languageDefaults';
import CenteredModal from '../components/UI/CenteredModal';
import LoadingOverlay from '../components/UI/LoadingOverlay';

const SettingsScreen = () => {

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

/*   const data = {
    'username': username,
    'email': email,
    'password': password,
    'password_confirmation': confirmPassword,
    'confirm_success_url': "exp://192.168.1.18:8081", 
  }; */


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

  const handleConfirm = () => {
    setIsLoading(true);
    switch (selectedOption) {
      case 'email':
        handleChangeEmail();
        break;
      case 'username':
        handleChangeUsername();
        break;
      case 'password':
        handleChangePassword();
        break;
      case 'delete':
        handleDeleteAccount();
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
          <View style={styles.boxContainer} testID="settings.screen">
            <Text style={styles.title}>Change Email:</Text>
            <TextInput
              accessibilityLabel="Settings email"
              testID="settings.input.email"
              value={email}
              onChangeText={setEmail}
              style={styles.textInput}
            />
            <Button accessibilityLabel="Save email" children="Save" onPress={() => handleButtonClick('email')} style={styles.button} testID="settings.button.save-email" />
  
            <Text style={styles.title}>Change Username:</Text>
            <TextInput
              accessibilityLabel="Settings username"
              testID="settings.input.username"
              value={username}
              onChangeText={setUsername}
              style={styles.textInput}
            />
            <Button accessibilityLabel="Save username" children="Save" onPress={() => handleButtonClick('username')} style={styles.button} testID="settings.button.save-username" />

            <Text style={styles.title}>Preferred language (for new enigmas):</Text>
            <View testID="settings.input.preferred-language">
              <LanguageSelector
                value={preferredLanguage}
                onChange={handleSelectPreferredLanguage}
                testIDPrefix="settings.input.preferred-language.selector"
              />
            </View>
          </View>
  
          <View style={styles.boxContainer}>
            
            <Text style={styles.title}>Change Password:</Text>
            <TextInput
              accessibilityLabel="Current password"
              testID="settings.input.current-password"
              value={oldPassword}
              onChangeText={setOldPassword}
              placeholder="Enter your current password"
              secureTextEntry
              style={styles.textInput}
            />
            <TextInput
              accessibilityLabel="New password"
              testID="settings.input.new-password"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter new password"
              secureTextEntry
              style={styles.textInput}
            />
            <TextInput
              accessibilityLabel="Confirm new password"
              testID="settings.input.confirm-password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
              secureTextEntry
              style={styles.textInput}
            />
            <Button 
              accessibilityLabel="Save password"
              children="Save" 
              onPress={() => handleButtonClick('password')} 
              style={styles.button} 
              testID="settings.button.save-password"
            />
          </View>
  
          <View style={styles.dangerZoneContainer}>
            <Text style={[styles.title,styles.dangerZoneText]}>Danger Zone:</Text>
            <Button 
              accessibilityLabel="Delete account"
              children="Delete Account" 
              onPress={() => handleButtonClick('delete')} 
              cancel={true} 
              style={styles.button}
              testID="settings.button.delete-account" /* add flat */ />
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
    alignItems: 'center',
    backgroundColor: "white"
  },
  scrollContainer: {
    flexGrow: 1,
    alignItems: 'center',
  },
  boxContainer: {
    flexDirection: 'column',
    padding: 30,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: GlobalStyle.color.tertiaryColor700,
  },
  textInput: {
    fontSize: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,

  },
  button: {
    marginTop: 10,
    backgroundColor: GlobalStyle.color.tertiaryColor900,
  },
  dangerZoneContainer: {
    flexDirection: 'center',
    alignItems: 'center',
    padding: 30,
    marginVertical: 30,
    borderTopColor: 'red',
    borderTopWidth: 1,
  },
  dangerZoneText: {
    color: 'red',
  }
})