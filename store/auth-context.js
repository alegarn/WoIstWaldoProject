import { createContext, useEffect, useRef, useState } from "react";
import * as SecureStore from 'expo-secure-store';

import { setUnauthorizedHandler } from "../utils/apiClient";
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
  isTutorialFinished: {},
  headers: {},
  IsAuthenticated: false,
  isAuthenticated: false,
  authenticate: () => {},
  logout: () => {},
  tokenAuthentication: () => {},
  restoreSession: () => {},
  saveScoreId: () => {},
  saveIsTutorialFinished: () => {},
  verifyIsLoggedIn: () => {},
  changeUserEmail: () => {},
  changeUsername: () => {},
});

export default function AuthContextProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authToken, setAuthToken] = useState(null);
  const [userId, setUserId] = useState('');
  const [scoreId, setScoreId] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');

  const [headers, setHeaders] = useState({});
  const [isTutorialFinished, setIsTutorialFinished] = useState({isTutorial: false, guessPathDone: false, hidePathDone: false});

  const logoutRef = useRef(logout);
  const isLoggingOutRef = useRef(false);

  useEffect(() => {
    logoutRef.current = logout;
  });

  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (!isLoggingOutRef.current) {
        void logoutRef.current();
      }
    });

    return () => {
      setUnauthorizedHandler(null);
    };
  }, []);


  function tokenAuthentication(token) {
    setAuthToken(token);
    setIsAuthenticated(!!token);
  };

  function buildHeaders({ token, userId, scoreId, email, username }) {
    return { token, userId, scoreId, email, username };
  };

  function restoreSession({ token, userId, email, username, scoreId, isTutorialFinished }) {
    setAuthToken(token);
    setUserId(userId ?? '');
    setScoreId(scoreId ?? '');
    setUsername((username && username !== 'undefined') ? username : '');
    setEmail(email ?? '');
    setHeaders(buildHeaders({ token, userId, scoreId, email, username }));

    if (isTutorialFinished) {
      setIsTutorialFinished(isTutorialFinished);
    };

    setIsAuthenticated(!!token);
  };

  async function saveIsTutorialFinished(isTutorialFinishedBool) {
    if (isTutorialFinishedBool === true) {
      await SecureStore.setItemAsync('isTutorialFinished', JSON.stringify({isTutorial: false, guessPathDone: true, hidePathDone: true}))
      setIsTutorialFinished({isTutorial: false, guessPathDone: true, hidePathDone: true});
    };
    
    if (isTutorialFinishedBool === false) {
      await SecureStore.setItemAsync('isTutorialFinished', JSON.stringify({isTutorial: true, guessPathDone: false, hidePathDone: false}))
      setIsTutorialFinished({isTutorial: true, guessPathDone: false, hidePathDone: false});
    };
  };

  async function authenticate({token, userId, email, username, isTutorialFinished, scoreId}) {
    await emptyImageList();

    setAuthToken(token);
    await SecureStore.setItemAsync('token', token);
    await SecureStore.setItemAsync('userId', userId);
    await SecureStore.setItemAsync('email', email);
    await SecureStore.setItemAsync('username', username ?? '');
    await SecureStore.setItemAsync('scoreId', scoreId);

    setUserId(userId);
    setScoreId(scoreId);
    setUsername(username);
    setEmail(email);
    setHeaders(buildHeaders({ token, userId, scoreId, email, username }));
    
    await saveIsTutorialFinished(isTutorialFinished);    

    setIsAuthenticated(true);
  };

  async function logout() {
    if (isLoggingOutRef.current) {
      return;
    }

    isLoggingOutRef.current = true;

    setAuthToken(null);
    setUserId('');
    setScoreId('');
    setUsername('');
    setEmail('');
    setHeaders({});
    setIsTutorialFinished({});
    setIsAuthenticated(false);

    try {
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('userId');
      await SecureStore.deleteItemAsync('email');
      await SecureStore.deleteItemAsync('username');
      await SecureStore.deleteItemAsync('isTutorialFinished');
      await SecureStore.deleteItemAsync('scoreId');

      await emptyImageList();
    } finally {
      isLoggingOutRef.current = false;
    }
  };

  async function saveScoreId(scoreId) {
    setScoreId(scoreId);
    await SecureStore.setItemAsync('scoreId', scoreId);
  };

  async function changeUserEmail(email) {
    setEmail(email);
    await SecureStore.setItemAsync('email', email);
  };

  async function changeUsername(username) {
    setUsername(username);
    await SecureStore.setItemAsync('username', username ?? '');
  };

  async function verifyIsLoggedIn() {
    const token = await SecureStore.getItemAsync('token');
    //console.log("verifyIsLoggedIn", "token", token, "authToken", authToken);
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
    client: '',
    uid: '',
    access_token: '',
    expiry: '',
    userId: userId,
    scoreId: scoreId,
    headers: headers,
    IsAuthenticated: !!authToken,
    isAuthenticated: !!authToken,
    username: username,
    email: email,
    isTutorialFinished: isTutorialFinished,
    authenticate: authenticate,
    logout: logout,
    tokenAuthentication: tokenAuthentication,
    restoreSession: restoreSession,
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
