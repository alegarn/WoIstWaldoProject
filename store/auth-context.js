import { createContext, useState } from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { emptyImageList } from "../utils/storageDatum";

export const AuthContext = createContext({
  token: '',
  client: '',
  uid: '',
  access_token: '',
  expiry: '',
  userId: '',
  scoreId: '',
  IsAuthenticated: false,
  authenticate: () => {},
  logout: () => {},
  tokenAuthentication: () => {},
  saveScoreId: () => {}
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

  function tokenAuthentication(token) {
    setAuthToken(token);
  };

  function authenticate({token, client, expiry, access_token, userId, uid}) {
    setAuthToken(token);
    AsyncStorage.setItem('token', token);
    AsyncStorage.setItem('client', client);
    AsyncStorage.setItem('expiry', expiry);
    AsyncStorage.setItem('access_token', access_token);
    AsyncStorage.setItem('userId', userId);
    AsyncStorage.setItem('uid', uid);
    setClient(client);
    setUid(uid);
    setIsAuthenticated(true);
    setExpiry(expiry);
    setAccess_token(access_token);
    setUserId(userId);
    console.log("context", token, expiry, access_token, userId, client, uid);
  };

  function logout() {
    setIsAuthenticated(false);
    setAuthToken(null);
    setClient('');
    setUid('');
    setExpiry('');
    setAccess_token('');
    setUserId('');
    setScoreId('');
    AsyncStorage.removeItem('token');
    AsyncStorage.removeItem('client');
    AsyncStorage.removeItem('expiry');
    AsyncStorage.removeItem('access_token');
    AsyncStorage.removeItem('uid');
    AsyncStorage.removeItem('userId');
    emptyImageList();
  };

  function saveScoreId(scoreId) {
    setScoreId(scoreId);
    AsyncStorage.setItem('scoreId', scoreId);
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
    saveScoreId: saveScoreId
  };
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
