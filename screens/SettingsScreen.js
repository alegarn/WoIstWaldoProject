import { useContext, useLayoutEffect, useState } from 'react';
import { View, Text, TextInput, Alert, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import Button from '../components/UI/Button';
import { GlobalStyle } from '../constants/theme';
import { updateUser } from '../utils/auth';
import { AuthContext } from '../store/auth-context';
import { checkSecureStoreItem } from '../utils/auth';

export default SettingsScreen = () => {

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [oldPassword, setOldPassword] = useState('');

  const context = useContext(AuthContext);

  const getEmail = async () => {

    // combine with the context
    const email = checkSecureStoreItem({ secureStoreValue: 'email', context })
    console.log("email", email); 
    console.log("email", typeof email);  
    return email;
  };

  const getUserName = async () => {
    // combine with the context
    const username = checkSecureStoreItem({ secureStoreValue: 'username', context })
    return username;
  };

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

  const handleChangeEmail = async () => {
    // Implement logic to change user's email
    const data = {
      'email': email
    };
    const response = await updateUser({ context, data });
    
    response?.status === 200
      && context.changeEmail(response.data.email) 
      && setEmail(response.data.email)
      && Alert.alert('Email changed successfully!', `Your new email is: ${response?.data?.email}`);;
    response?.status !== 200 && Alert.alert(`Error status code: ${response?.status}`, `${response?.data}`);
    console.log("setting response", response?.status);
  };

  const handleChangeUsername = () => {
    const data = {
      'username': username
    };
    //unpermitted_parameters
    const response = updateUser({ context, data });
    // Implement logic to change user's username
    Alert.alert('Username changed ?');
  };

  const handleChangePassword = () => {
    // Implement logic to change user's password
    const data = {
      'current_password': oldPassword,
      'password': password,
      'password_confirmation': confirmPassword
    };
    const response = updateUser({ context, data });
    response?.status === 'success' &&
      Alert.alert('Password changed successfully!', 'Your new password is ready!');
      // weird error (success but error)
    response?.status !== 'success' &&
      Alert.alert('Error', `${response?.data}`);
  };

  const handleDeleteAccount = () => {
    // Implement logic to delete user's account
    Alert.alert('Account deleted successfully!');
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
          <Button children="Save" onPress={handleChangeEmail} style={styles.button} />

          <Text style={styles.title}>Change Username:</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            style={styles.textInput}
          />
          <Button children="Save" onPress={handleChangeUsername} style={styles.button} />

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
          <Button children="Save" onPress={handleChangePassword} style={styles.button} />
        </View>

        <View style={styles.dangerZoneContainer}>
          <Text style={[styles.title,styles.dangerZoneText]}>Danger Zone:</Text>
          <Button children="Delete Account" onPress={handleDeleteAccount} cancel={true} style={styles.button} /* add flat */ />
        </View>
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