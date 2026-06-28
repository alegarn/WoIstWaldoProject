import { createContext, useContext, useEffect, useRef, useState } from "react";
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
  isPremium: false,
  premiumTier: 0,
  isGroupOwner: false,
  activeGroupId: null,
  authenticate: () => {},
  logout: () => {},
  tokenAuthentication: () => {},
  restoreSession: () => {},
  saveScoreId: () => {},
  saveIsTutorialFinished: () => {},
  verifyIsLoggedIn: () => {},
  changeUserEmail: () => {},
  changeUsername: () => {},
  setEntitlement: () => {},
  setActiveGroupId: () => {},
});

export function useAuthContext() {
  return useContext(AuthContext);
}

function configureCreatorBilling({ userId }) {
  if (!userId) {
    return;
  }

  try {
    const Purchases = require('react-native-purchases').Purchases;
    const Platform = require('react-native').Platform;
    const apiKey = Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
      : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

    if (!apiKey) {
      return;
    }

    Purchases.configure({ apiKey, appUserID: `user:${userId}` });
  } catch (error) {
    console.warn('configureCreatorBilling failed', error?.message ?? error);
  }
}

async function teardownCreatorBilling() {
  try {
    const Purchases = require('react-native-purchases').Purchases;

    if (typeof Purchases?.logOut === 'function') {
      await Purchases.logOut();
    }
  } catch (error) {
    console.warn('teardownCreatorBilling failed', error?.message ?? error);
  }
}

export default function AuthContextProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authToken, setAuthToken] = useState(null);
  const [userId, setUserId] = useState('');
  const [scoreId, setScoreId] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [premiumTier, setPremiumTier] = useState(0);
  const [isGroupOwner, setIsGroupOwner] = useState(false);
  const [activeGroupId, setActiveGroupIdState] = useState(null);

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

  function restoreSession({ token, userId, email, username, scoreId, isTutorialFinished, isPremium, premiumTier, isGroupOwner, activeGroupId }) {
    setAuthToken(token);
    setUserId(userId ?? '');
    setScoreId(scoreId ?? '');
    setUsername((username && username !== 'undefined') ? username : '');
    setEmail(email ?? '');
    setHeaders(buildHeaders({ token, userId, scoreId, email, username }));
    setIsPremium(!!isPremium);
    setPremiumTier(Number.isFinite(premiumTier) ? premiumTier : 0);
    setIsGroupOwner(!!isGroupOwner);
    setActiveGroupIdState(activeGroupId ?? null);

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

  async function authenticate({token, userId, email, username, isTutorialFinished, scoreId, isPremium, premiumTier, isGroupOwner, activeGroupId}) {
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
    setIsPremium(!!isPremium);
    setPremiumTier(Number.isFinite(premiumTier) ? premiumTier : 0);
    setIsGroupOwner(!!isGroupOwner);
    setActiveGroupIdState(activeGroupId ?? null);

    configureCreatorBilling({ userId });

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
    setIsPremium(false);
    setPremiumTier(0);
    setIsGroupOwner(false);
    setActiveGroupIdState(null);
    setIsAuthenticated(false);

    try {
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('userId');
      await SecureStore.deleteItemAsync('email');
      await SecureStore.deleteItemAsync('username');
      await SecureStore.deleteItemAsync('isTutorialFinished');
      await SecureStore.deleteItemAsync('scoreId');

      await emptyImageList();

      await teardownCreatorBilling();

      try {
        const { purgeAllPrivateCaches } = require('../services/groups/groupFeedCache');
        await purgeAllPrivateCaches();
      } catch (error) {
        console.warn('purgeAllPrivateCaches failed', error?.message ?? error);
      }
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

  async function setEntitlement({ isPremium, premiumTier, premiumExpiresAt } = {}) {
    if (isPremium !== undefined) {
      setIsPremium(!!isPremium);
    }
    if (premiumTier !== undefined) {
      setPremiumTier(Number.isFinite(premiumTier) ? premiumTier : 0);
    }
  };

  async function setActiveGroupId(groupId) {
    setActiveGroupIdState(groupId ?? null);
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
    isPremium: isPremium,
    premiumTier: premiumTier,
    isGroupOwner: isGroupOwner,
    activeGroupId: activeGroupId,
    authenticate: authenticate,
    logout: logout,
    tokenAuthentication: tokenAuthentication,
    restoreSession: restoreSession,
    saveScoreId: saveScoreId,
    saveIsTutorialFinished: saveIsTutorialFinished,
    verifyIsLoggedIn: verifyIsLoggedIn,
    changeUserEmail: changeUserEmail,
    changeUsername: changeUsername,
    setEntitlement: setEntitlement,
    setActiveGroupId: setActiveGroupId,
    turnTutorialOn: turnTutorialOn,
    updateTutorialStatus: updateTutorialStatus
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
