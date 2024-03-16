import { createContext, useState } from "react";
import * as SecureStore from 'expo-secure-store';

import { emptyImageList } from "../utils/storageDatum";

export const AuthContext = createContext({
  token: '',
  client: '',
  uid: '',
  access_token: '',
  expiry: '',
  userId: '',
  scoreId: '',
  headers: {},
  IsAuthenticated: false,
  authenticate: () => {},
  logout: () => {},
  tokenAuthentication: () => {},
  saveScoreId: () => {},
  verifyIsLoggedIn: () => {},
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
  const [username, setUsername] = useState('');

  const [headers, setHeaders] = useState({});

  function tokenAuthentication(token) {
    setAuthToken(token);
  };

  async function authenticate({token, client, expiry, access_token, userId, uid, email, username}) {
    setAuthToken(token);
    await SecureStore.setItemAsync('token', token);
    await SecureStore.setItemAsync('client', client);
    await SecureStore.setItemAsync('expiry', expiry);
    await SecureStore.setItemAsync('access_token', access_token);
    await SecureStore.setItemAsync('uid', uid);
    await SecureStore.setItemAsync('userId', userId);
    await SecureStore.setItemAsync('email', email);
    await SecureStore.setItemAsync('username', username);
    setClient(client);
    setUid(uid);
    setIsAuthenticated(true);
    setExpiry(expiry);
    setAccess_token(access_token);
    setUserId(userId);
    setUsername(username);
    setHeaders({ token, client, expiry, access_token, userId, uid, email });
    console.log("context", token, expiry, access_token, userId, client, uid, email);
  };

  async function logout() {
    setIsAuthenticated(false);
    setAuthToken(null);
    setClient('');
    setUid('');
    setExpiry('');
    setAccess_token('');
    setUserId('');
    setScoreId('');
    setUsername('');
    setHeaders({});
    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('client');
    await SecureStore.deleteItemAsync('expiry');
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('uid');
    await SecureStore.deleteItemAsync('userId');
    await SecureStore.deleteItemAsync('email');
    await SecureStore.deleteItemAsync('username');
    emptyImageList();
  };

  async function saveScoreId(scoreId) {
    setScoreId(scoreId);
    await SecureStore.setItemAsync('scoreId', scoreId);
  };


  async function verifyIsLoggedIn() {
    const token = await SecureStore.getItemAsync('token');
    console.log("verifyIsLoggedIn", "token", token, "authToken", authToken);
    if (token || authToken) {
      setIsAuthenticated(true);
      return true;
    } else {
      setIsAuthenticated(false);
      return false;
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
    headers: headers,
    IsAuthenticated: !!authToken,
    authenticate: authenticate,
    logout: logout,
    tokenAuthentication: tokenAuthentication,
    saveScoreId: saveScoreId,
    verifyIsLoggedIn: verifyIsLoggedIn
  };
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
