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
  username: '',
  email: '',
  isTutorialFinished: false,
  headers: {},
  IsAuthenticated: false,
  authenticate: () => {},
  logout: () => {},
  tokenAuthentication: () => {},
  saveScoreId: () => {},
  saveIsTutorialFinished: () => {},
  verifyIsLoggedIn: () => {},
  changeUserEmail: () => {},
  changeUsername: () => {},
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
  const [email, setEmail] = useState('');

  const [headers, setHeaders] = useState({});
  const [isTutorialFinished, setIsTutorialFinished] = useState({isTutorial: true, guessPathDone: false, hidePathDone: false});

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
    /* variable to server */
    await SecureStore.setItemAsync('isTutorialFinished', JSON.stringify({isTutorial: true, guessPathDone: false, hidePathDone: false}));

    setClient(client);
    setUid(uid);
    setIsAuthenticated(true);
    setExpiry(expiry);
    setAccess_token(access_token);
    setUserId(userId);
    setUsername(username);
    setEmail(email);
    /* variable to server, related to isTutorialFinished */
    setIsTutorialFinished({isTutorial: true, guessPathDone: false, hidePathDone: false});
    
    setHeaders({ token, client, expiry, access_token, userId, uid, email });
    console.log("context", token, expiry, access_token, userId, client, uid, email);
  };

  async function logout() {
    setAuthToken(null);
    setClient('');
    setUid('');
    setExpiry('');
    setAccess_token('');
    setUserId('');
    setScoreId('');
    setUsername('');
    setEmail('');
    setHeaders({});
    setIsTutorialFinished({});

    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('client');
    await SecureStore.deleteItemAsync('expiry');
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('uid');
    await SecureStore.deleteItemAsync('userId');
    await SecureStore.deleteItemAsync('email');
    await SecureStore.deleteItemAsync('username');
    await SecureStore.deleteItemAsync('isTutorialFinished');

    await emptyImageList();
    setIsAuthenticated(false);
  };

  async function saveScoreId(scoreId) {
    setScoreId(scoreId);
    await SecureStore.setItemAsync('scoreId', scoreId);
  };

  async function saveIsTutorialFinished(isTutorialFinished) {
    if (isTutorialFinished) {
      await SecureStore.setItemAsync('isTutorialFinished', JSON.stringify({isTutorial: false, guessPathDone: true, hidePathDone: true}))
      setIsTutorialFinished({isTutorial: false, guessPathDone: true, hidePathDone: true});
    };
    
    if (isTutorialFinished === false) {
      await SecureStore.setItemAsync('isTutorialFinished', JSON.stringify({isTutorial: true, guessPathDone: false, hidePathDone: false}))
      setIsTutorialFinished({isTutorial: true, guessPathDone: false, hidePathDone: false});
    };
    
  };

  async function changeUserEmail(email) {
    setEmail(email);
    setUid(email);
    await SecureStore.setItemAsync('email', email);
  };

  async function changeUsername(username) {
    setUsername(username);
    await SecureStore.setItemAsync('username', username);
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

  async function turnTutorialOn(answer) {
    setIsTutorialFinished({
      isTutorial: answer, 
      guessPathDone: isTutorialFinished?.guessPathDone, 
      hidePathDone: isTutorialFinished?.hidePathDone
    });
  };

  async function updateTutorialStatus(isTutorialFinished) {
    console.log("isTutorialFinished", JSON.stringify(isTutorialFinished));
    await SecureStore.setItemAsync('isTutorialFinished', JSON.stringify(isTutorialFinished));
    setIsTutorialFinished(isTutorialFinished);
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
    username: username,
    email: email,
    isTutorialFinished: isTutorialFinished,
    authenticate: authenticate,
    logout: logout,
    tokenAuthentication: tokenAuthentication,
    saveScoreId: saveScoreId,
    saveIsTutorialFinished: saveIsTutorialFinished,
    verifyIsLoggedIn: verifyIsLoggedIn,
    changeUserEmail: changeUserEmail,
    changeUsername: changeUsername,
    turnTutorialOn: turnTutorialOn,
    updateTutorialStatus: updateTutorialStatus
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
