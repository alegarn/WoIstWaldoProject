import { createContext, useState } from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';

export const AuthContext = createContext({
  token: '',
  client: '',
  uid: '',
  access_token: '',
  expiry: '',
  userId: '',
  IsAuthenticated: false,
  authenticate: () => {},
  logout: () => {},
});

export default function AuthContextProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authToken, setAuthToken] = useState(null);
  const [client, setClient] = useState('');
  const [uid, setUid] = useState('');
  const [expiry, setExpiry] = useState('');
  const [access_token, setAccess_token] = useState('');

  const [userId, setUserId] = useState('');


  function tokenAuthentication(token) {
    setAuthToken(token);
  };

  function authenticate({token, client, expiry, access_token, userId, uid}) {
    setAuthToken(token);
    AsyncStorage.setItem('token', token);
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
    AsyncStorage.removeItem('token');
    setAuthToken(null);
    setClient('');
    setUid('');
    setExpiry('');
    setAccess_token('');
    setUserId('');
  };

  const value = {
    token: authToken,
    client: client,
    uid: uid,
    access_token: access_token,
    expiry: expiry,
    userId: userId,
    IsAuthenticated: !!authToken,
    authenticate: authenticate,
    logout: logout,
    tokenAuthentication: tokenAuthentication,
  };
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
