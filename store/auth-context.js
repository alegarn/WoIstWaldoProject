import { createContext, useState } from "react";
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { emptyImageList } from "../utils/storageDatum";
import { Alert } from "react-native";
import { errorLog } from "../utils/errorLog";

export const AuthContext = createContext({
  token: '',
  client: '',
  uid: '',
  access_token: '',
  expiry: '',
  userId: '',
  scoreId: '',
  IsAuthenticated: false,
  imageList: '',
  lastImageUuid: '',
  authenticate: () => {},
  logout: () => {},
  tokenAuthentication: () => {},
  saveScoreId: () => {},
  logs: "",
});

export default function AuthContextProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authToken, setAuthToken] = useState(null);
  const [client, setClient] = useState('');
  const [uid, setUid] = useState('');
  const [expiry, setExpiry] = useState('');
  const [access_token, setAccess_token] = useState('');

  const [userId, setUserId] = useState('');
  const [scoreId, setScoreId] = useState('');

  const [imageList, setImageList] = useState('');
  const [lastImageUuid, setLastImageUuid] = useState('');


  function tokenAuthentication(token) {
    setAuthToken(token);
  };

  async function authenticate({token, client, expiry, access_token, userId, uid}) {
    try {
      await SecureStore.setItemAsync('token', token);
      await SecureStore.setItemAsync('client', client);
      await SecureStore.setItemAsync('expiry', expiry);
      await SecureStore.setItemAsync('access_token', access_token);
      await SecureStore.setItemAsync('userId', userId);
      await SecureStore.setItemAsync('uid', uid);
    } catch (error) {
      errorLog({ functionName: "/store/auth-context.js authenticate", error: error.message});
    };
    setAuthToken(token);
    setClient(client);
    setUid(uid);
    setIsAuthenticated(true);
    setExpiry(expiry);
    setAccess_token(access_token);
    setUserId(userId);
    //console.log("context", token, expiry, access_token, userId, client, uid);
  };

  const logout = async () => {
    setIsAuthenticated(false);
    setAuthToken('');
    setClient('');
    setUid('');
    setExpiry('');
    setAccess_token('');
    setUserId('');
    setScoreId('');
    try {
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('client');
      await SecureStore.deleteItemAsync('expiry');
      await SecureStore.deleteItemAsync('access_token');
      await SecureStore.deleteItemAsync('uid');
      await SecureStore.deleteItemAsync('userId');
      await SecureStore.deleteItemAsync('scoreId');
    } catch (error) {
      Alert.alert("Error logout removeItem", error.message);
      errorLog({ functionName: "/store/auth-context.js logout", error: error.message });
    };
    try {
      await emptyImageList(imageList);
    } catch (error) {
      errorLog({ functionName: "/store/auth-context.js logout emptyImageList", error: error.message });
    };
    setImageList('');
    setLastImageUuid('');
    console.log("logout", "authToken", authToken, client, expiry, access_token, userId, client, uid);
    return true;
  };

  async function saveScoreId(scoreId) {
    setScoreId(scoreId);
    try {
      await SecureStore.setItemAsync('scoreId', scoreId);
    } catch (error) {
      errorLog({ functionName: "/store/auth-context.js saveScoreId", error: error.message });
    };
  };

  const value = {
    token: authToken,
    client: client,
    uid: uid,
    access_token: access_token,
    expiry: expiry,
    userId: userId,
    scoreId: scoreId,
    IsAuthenticated: !!authToken,
    authenticate: authenticate,
    logout: logout,
    tokenAuthentication: tokenAuthentication,
    saveScoreId: saveScoreId,
    imageList: imageList,
    lastImageUuid: lastImageUuid,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
