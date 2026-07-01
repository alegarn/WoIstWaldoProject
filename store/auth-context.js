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
  premiumExpiresAt: null,
  isGroupOwner: false,
  activeGroupId: null,
  isPrivateMode: false,
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
  setPrivateMode: () => {},
});

export function useAuthContext() {
  return useContext(AuthContext);
}

let customerInfoListener = null;
let syncEntitlementTimer = null;
const SYNC_ENTITLEMENT_DEBOUNCE_MS = 1000;

function configureCreatorBilling({ userId, authContextRef }) {
  if (!userId) {
    return;
  }

  try {
    const Purchases = require('react-native-purchases').default;
    const Platform = require('react-native').Platform;

    if (__DEV__) {
      Purchases.setLogLevel(Purchases.LOG_LEVEL.VERBOSE);
    }

    const platformKey = Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
      : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

    const apiKey = __DEV__ && process.env.EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY
      ? process.env.EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY
      : platformKey;

    if (!apiKey) {
      console.warn('RevenueCat: missing API key — purchases disabled');
      return;
    }

    Purchases.configure({ apiKey, appUserID: `user:${userId}` });

    if (typeof Purchases.addCustomerInfoUpdateListener === 'function') {
      const handleCustomerInfoUpdate = () => {
        if (syncEntitlementTimer) {
          clearTimeout(syncEntitlementTimer);
        }

        syncEntitlementTimer = setTimeout(async () => {
          syncEntitlementTimer = null;

          try {
            const context = authContextRef?.current;
            if (!context) {
              return;
            }

            const { syncEntitlement } = require('../services/billing/billingApi');
            const response = await syncEntitlement(context);
            const entitlement = response?.data;

            if (entitlement) {
              context.setEntitlement({
                isPremium: entitlement.is_premium,
                premiumTier: entitlement.premium_tier,
                premiumExpiresAt: entitlement.premium_expires_at,
                isGroupOwner: entitlement.is_group_owner,
                activeGroupId: entitlement.active_group_id,
              });
            }
          } catch (error) {
            console.warn('customerInfo listener sync failed', error?.message ?? error);
          }
        }, SYNC_ENTITLEMENT_DEBOUNCE_MS);
      };

      customerInfoListener = handleCustomerInfoUpdate;
      Purchases.addCustomerInfoUpdateListener(handleCustomerInfoUpdate);
    }
  } catch (error) {
    console.warn('configureCreatorBilling failed', error?.message ?? error);
  }
}

async function teardownCreatorBilling() {
  try {
    const Purchases = require('react-native-purchases').default;

    if (syncEntitlementTimer) {
      clearTimeout(syncEntitlementTimer);
      syncEntitlementTimer = null;
    }

    if (customerInfoListener && typeof Purchases?.removeCustomerInfoUpdateListener === 'function') {
      try {
        Purchases.removeCustomerInfoUpdateListener(customerInfoListener);
      } catch (error) {
        console.warn('removeCustomerInfoUpdateListener failed', error?.message ?? error);
      }
      customerInfoListener = null;
    }

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
  const [premiumExpiresAt, setPremiumExpiresAt] = useState(null);
  const [isGroupOwner, setIsGroupOwner] = useState(false);
  const [activeGroupId, setActiveGroupIdState] = useState(null);
  const [isPrivateMode, setIsPrivateModeState] = useState(false);

  const [headers, setHeaders] = useState({});
  const [isTutorialFinished, setIsTutorialFinished] = useState({isTutorial: false, guessPathDone: false, hidePathDone: false});

  const logoutRef = useRef(logout);
  const isLoggingOutRef = useRef(false);
  const authContextRef = useRef(null);

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

  function restoreSession({ token, userId, email, username, scoreId, isTutorialFinished, isPremium, premiumTier, premiumExpiresAt, isGroupOwner, activeGroupId, isPrivateMode }) {
    setAuthToken(token);
    setUserId(userId ?? '');
    setScoreId(scoreId ?? '');
    setUsername((username && username !== 'undefined') ? username : '');
    setEmail(email ?? '');
    setHeaders(buildHeaders({ token, userId, scoreId, email, username }));
    setIsPremium(!!isPremium);
    setPremiumTier(Number.isFinite(premiumTier) ? premiumTier : 0);
    setPremiumExpiresAt(premiumExpiresAt ?? null);
    setIsGroupOwner(!!isGroupOwner);
    setActiveGroupIdState(activeGroupId ?? null);
    setIsPrivateModeState(!!isPrivateMode);

    if (isTutorialFinished) {
      setIsTutorialFinished(isTutorialFinished);
    };

    configureCreatorBilling({ userId, authContextRef });

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

  async function authenticate({token, userId, email, username, isTutorialFinished, scoreId, isPremium, premiumTier, premiumExpiresAt, isGroupOwner, activeGroupId}) {
    await emptyImageList();

    setAuthToken(token);
    await SecureStore.setItemAsync('token', token);
    await SecureStore.setItemAsync('userId', userId);
    await SecureStore.setItemAsync('email', email);
    await SecureStore.setItemAsync('username', username ?? '');
    await SecureStore.setItemAsync('scoreId', scoreId);
    await SecureStore.setItemAsync('isPremium', JSON.stringify(!!isPremium));
    await SecureStore.setItemAsync('premiumTier', JSON.stringify(Number.isFinite(premiumTier) ? premiumTier : 0));
    await SecureStore.setItemAsync('premiumExpiresAt', JSON.stringify(premiumExpiresAt ?? null));
    await SecureStore.setItemAsync('isGroupOwner', JSON.stringify(!!isGroupOwner));
    await SecureStore.setItemAsync('activeGroupId', JSON.stringify(activeGroupId ?? null));
    await SecureStore.setItemAsync('isPrivateMode', JSON.stringify(false));

    setUserId(userId);
    setScoreId(scoreId);
    setUsername(username);
    setEmail(email);
    setHeaders(buildHeaders({ token, userId, scoreId, email, username }));
    setIsPremium(!!isPremium);
    setPremiumTier(Number.isFinite(premiumTier) ? premiumTier : 0);
    setPremiumExpiresAt(premiumExpiresAt ?? null);
    setIsGroupOwner(!!isGroupOwner);
    setActiveGroupIdState(activeGroupId ?? null);
    setIsPrivateModeState(false);

    configureCreatorBilling({ userId, authContextRef });

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
    setPremiumExpiresAt(null);
    setIsGroupOwner(false);
    setActiveGroupIdState(null);
    setIsPrivateModeState(false);
    setIsAuthenticated(false);

    try {
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('userId');
      await SecureStore.deleteItemAsync('email');
      await SecureStore.deleteItemAsync('username');
      await SecureStore.deleteItemAsync('isTutorialFinished');
      await SecureStore.deleteItemAsync('scoreId');
      await SecureStore.deleteItemAsync('isPremium');
      await SecureStore.deleteItemAsync('premiumTier');
      await SecureStore.deleteItemAsync('premiumExpiresAt');
      await SecureStore.deleteItemAsync('isGroupOwner');
      await SecureStore.deleteItemAsync('activeGroupId');
      await SecureStore.deleteItemAsync('isPrivateMode');

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

  async function setEntitlement({ isPremium, premiumTier, premiumExpiresAt, isGroupOwner, activeGroupId } = {}) {
    if (isPremium !== undefined) {
      setIsPremium(!!isPremium);
      await SecureStore.setItemAsync('isPremium', JSON.stringify(!!isPremium));
    }
    if (premiumTier !== undefined) {
      const tier = Number.isFinite(premiumTier) ? premiumTier : 0;
      setPremiumTier(tier);
      await SecureStore.setItemAsync('premiumTier', JSON.stringify(tier));
    }
    if (premiumExpiresAt !== undefined) {
      const expiresAt = premiumExpiresAt ?? null;
      setPremiumExpiresAt(expiresAt);
      await SecureStore.setItemAsync('premiumExpiresAt', JSON.stringify(expiresAt));
    }
    if (isGroupOwner !== undefined) {
      setIsGroupOwner(!!isGroupOwner);
      await SecureStore.setItemAsync('isGroupOwner', JSON.stringify(!!isGroupOwner));
    }
    if (activeGroupId !== undefined) {
      const groupId = activeGroupId ?? null;
      setActiveGroupIdState(groupId);
      await SecureStore.setItemAsync('activeGroupId', JSON.stringify(groupId));
    }
  };

  async function setActiveGroupId(groupId) {
    setActiveGroupIdState(groupId ?? null);
  };

  async function setPrivateMode(isEnabled) {
    setIsPrivateModeState(!!isEnabled);
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
    premiumExpiresAt: premiumExpiresAt,
    isGroupOwner: isGroupOwner,
    activeGroupId: activeGroupId,
    isPrivateMode: isPrivateMode,
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
    setPrivateMode: setPrivateMode,
    turnTutorialOn: turnTutorialOn,
    updateTutorialStatus: updateTutorialStatus
  };

  useEffect(() => {
    authContextRef.current = value;
  });

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
