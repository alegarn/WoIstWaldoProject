import { useContext, useEffect, useLayoutEffect, useState } from 'react';
import { View, Text, TextInput, Alert, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import Button from '../components/UI/Button';
import { GlobalStyle } from '../constants/theme';
import { updateUser, deleteAccount } from '../utils/auth';
import { AuthContext } from '../store/auth-context';
import { checkSecureStoreItem } from '../utils/auth';
import CenteredModal from '../components/UI/CenteredModal';

export default SettingsScreen = () => {

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [oldPassword, setOldPassword] = useState('');

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
    getEmail().then((email) => {
      setEmail(email);
    });
    getUserName().then((username) => {
      setUsername(username);
    });
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
    response?.status === 200
      && context.changeUserEmail(response?.data?.email) 
      && Alert.alert('Email changed successfully!', `Your new email is: ${response?.data?.email}`);
    response?.status !== 200 && Alert.alert(`Error status code: ${response?.status}`, `There is an an error: ${response?.data}.`);
    console.log("setting response", response?.status);
  };

  const handleChangeUsername = async () => {
    const data = {
      'username': username,
    };

    const response = await updateUser({ context, data });
    console.log("handleChangeUsername setting response", response);
    response?.status === 200
      && context.changeUsername(username)
      && Alert.alert('Username changed successfully!', `Your new username is ${response?.data?.username}`);
    response?.status !== 200 && Alert.alert(`Error status code: ${response?.status}`,`There is an an error: ${response?.data}\n\nYou can retry later or your username is already taken.`);

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
      Alert.alert('Account deleted successfully!', `${response?.data?.message}\nWe are sorry to see you go!`);
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
    setIsModalVisible(false);
  };


  const handleCancel = () => {
    setIsModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.boxContainer}>
          <Text style={styles.title}>Change Email:</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            style={styles.textInput}
          />
          <Button children="Save" onPress={() => handleButtonClick('email')} style={styles.button} />

          <Text style={styles.title}>Change Username:</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            style={styles.textInput}
          />
          <Button children="Save" onPress={() => handleButtonClick('username')} style={styles.button} />

        </View>

        <View style={styles.boxContainer}>
          
          <Text style={styles.title}>Change Password:</Text>
          <TextInput
            value={oldPassword}
            onChangeText={setOldPassword}
            placeholder="Enter your current password"
            secureTextEntry
            style={styles.textInput}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Enter new password"
            secureTextEntry
            style={styles.textInput}
          />
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm new password"
            secureTextEntry
            style={styles.textInput}
          />
          <Button 
            children="Save" 
            onPress={() => handleButtonClick('password')} 
            style={styles.button} 
          />
        </View>

        <View style={styles.dangerZoneContainer}>
          <Text style={[styles.title,styles.dangerZoneText]}>Danger Zone:</Text>
          <Button 
            children="Delete Account" 
            onPress={() => handleButtonClick('delete')} 
            cancel={true} 
            style={styles.button} /* add flat */ />
        </View>
        <CenteredModal 
          isModalVisible={isModalVisible} 
          onPress={handleConfirm} 
          onCancel={handleCancel} 
          children={confirmMessage}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

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