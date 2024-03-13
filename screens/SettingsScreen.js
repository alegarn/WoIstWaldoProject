import { useLayoutEffect, useState } from 'react';
import { View, Text, TextInput, Alert, StyleSheet } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Button from '../components/UI/Button';
import { GlobalStyle } from '../constants/theme';
import { getUserName } from '../utils/auth';

export default SettingsScreen = () => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [oldPassword, setOldPassword] = useState('');

  const getEmail = async () => {
    // combine with the context
    const email = await SecureStore.getItemAsync('email'); 
    console.log("email", email); 
    console.log("email", typeof email);  
    return email;
  };

  const getUsername = async () => {
    const username = await getUserName();
    setUsername(username);
  };

  useLayoutEffect(() => {
    getEmail().then((email) => {
      setEmail(email);
    })
  })


  const handleChangeEmail = () => {
    // Implement logic to change user's email
    Alert.alert('Email changed successfully!');
  };

  const handleChangePassword = () => {
    // Implement logic to change user's password
    Alert.alert('Password changed successfully!');
  };

  const handleDeleteAccount = () => {
    // Implement logic to delete user's account
    Alert.alert('Account deleted successfully!');
  };

  return (
    <View style={styles.container}>
      <View style={styles.boxContainer}>
        <Text style={styles.title}>Change Email:</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder={"Enter new email (current: " +`${email})`}
          style={styles.textInput}
        />
        <Button children="Save" onPress={handleChangeEmail} style={styles.button} />

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
          onChangeText={confirmPassword}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: "white"
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