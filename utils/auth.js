import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const AUTH_STORAGE_KEYS = ['token', 'userId'];
const PERSISTED_SESSION_KEYS = [...AUTH_STORAGE_KEYS, 'email', 'username', 'scoreId', 'isTutorialFinished'];
const BEARER_TOKEN_REGEX = /^Bearer [A-Za-z0-9\-._~+/]+=*$/;


function isNullOrUndefined(value) {
  return value === undefined || value === null;
};

function isNullUndefinedOrEmpty(value) {
  return isNullOrUndefined(value) || value === '';
};

function parseStoredJsonValue(value) {
  if (isNullUndefinedOrEmpty(value)) {
    return null;
  };

  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  };
};

async function getStoredValues(keys) {
  const values = await Promise.all(keys.map((key) => SecureStore.getItemAsync(key)));

  return keys.reduce((accumulator, key, index) => {
    accumulator[key] = values[index];
    return accumulator;
  }, {});
};

export function hasCompleteAuthState(authState) {
  return AUTH_STORAGE_KEYS.every((key) => !isNullUndefinedOrEmpty(authState?.[key]));
};

export function isPersistedBearerToken(token) {
  return typeof token === 'string' && BEARER_TOKEN_REGEX.test(token);
};

export async function getStoredAuthState() {
  const storedState = await getStoredValues(PERSISTED_SESSION_KEYS);

  return {
    ...storedState,
    isTutorialFinished: parseStoredJsonValue(storedState.isTutorialFinished),
  };
};

export async function bootstrapStoredAuthSession(restoreSession) {
  const storedAuthState = await getStoredAuthState();

  if (!hasCompleteAuthState(storedAuthState) || !isPersistedBearerToken(storedAuthState.token)) {
    return false;
  };

  restoreSession(storedAuthState);
  return true;
};


export async function getBackendHeadersFromStorage() {
  const { token, userId, scoreId } = await getStoredAuthState();
  return { token, userId, scoreId };
};

export async function getBackendHeadersFromContext(context) {
  const { token, userId, scoreId } = context ?? {};
  return { token, userId, scoreId };
};

export async function getBackendHeaders(context) {
  const contextHeaders = await getBackendHeadersFromContext(context);

  if (hasCompleteAuthState(contextHeaders) && !isNullUndefinedOrEmpty(contextHeaders.scoreId)) {
    return contextHeaders;
  };

  const storedHeaders = await getBackendHeadersFromStorage();

  if (hasCompleteAuthState(contextHeaders)) {
    return {
      ...storedHeaders,
      ...contextHeaders,
      scoreId: contextHeaders.scoreId || storedHeaders.scoreId,
    };
  };

  return storedHeaders;
};

export function setHeaders({ token }) {
  const headers = {
    Authorization: token,
    HTTP_AUTHORIZATION: token,
    "Content-Type": "application/json;charset=UTF-8",
    Accept: "*/*",
  };
  return headers;
};

function mapRequestError(error) {
  return {
    status: error?.response?.status ?? error?.request?.status,
    data: error?.response?.data ?? error,
  };
};


async function authenticateUser({ email, password }) {
  const url = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}auth/sign_in`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  };
  const data = {
    email: email,
    password: password,
  };
  
  const response = await axios.post(url, data, config)
    .then((response) => {
      return response;
    }).catch((error) => {
      return error.response ?? mapRequestError(error);
    });
  
  return response;
};

export async function getScoreId(context) {
  const { token, userId } = await getBackendHeaders(context);
  const url = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/users/${userId}/get_score_id`;
  const headers = setHeaders({ token });
  const config = {
    headers: headers,
  };

  const response = await axios.get(url, config).then((response) => {
    return {status: response.status, data: response.data };
  }).catch((error) => {
    const mappedError = mapRequestError(error);
    return { status: mappedError.status, data: mappedError.data };
  });

  return response;
};

export async function createUser({ email, password, confirmPassword, username }) {

  const url = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}auth`
  const config = {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  };

  const data = {
    username: username,
    email: email,
    password: password,
    password_confirmation: confirmPassword,
  };
  
  const response = await axios.post(url, data, config).then((response) => {
    return response;
  }).catch((error) => {
    return error.response ?? mapRequestError(error);
  });
  
  return response;
};

export async function login({email, password}) {
  return await authenticateUser({email, password});
};


/* export async function logout({ context }) {
  const { token } = await getBackendHeaders(context);
  const url = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}auth/sign_out`;
  const headers = setHeaders({ token });
  const config = {
    headers: headers,
  };
  const response = await axios.delete(url, config).then((response) => {
    return { status: response.status, data: response.data };
  }).catch((error) => {
    console.log("error logout", error.request);
    return { status: error.request.status, data: error };
  });
  return response;
}; */

export async function checkSecureStoreItem({ secureStoreValue, context }) {
  const item = await SecureStore.getItemAsync(secureStoreValue);

  if (!isNullOrUndefined(item)) {
    return item;
  };

  return context?.[secureStoreValue] ?? null;
};

export async function getUserName({ context }) {
  const { token, userId } = await getBackendHeaders(context);
  const url = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/users/${userId}/get_user_name`;
  const headers = setHeaders({ token });
  const config = {
    headers: headers,
  };

  const response = await axios.get(url, config).then((response) => {
    return { status: response.status, data: response.data };
  }).catch((error) => {
    const mappedError = mapRequestError(error);
    return { status: mappedError.status, data: mappedError.data};
  });

  return response;
};

export async function updateUser({ context, data }) {
  const { token } = await getBackendHeaders(context);
  const url = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}auth/`;
  const headers = setHeaders({ token });
  const config = {
    headers: headers,
  };

  const response = await axios.put(url, data, config).then((response) => {
    return { status: response.status, data: response.data.data ?? response.data };
  }).catch((error) => {
    const mappedError = mapRequestError(error);
    return { status: mappedError.status, data: mappedError.data };
  });
  return response;
};

export async function deleteAccount({ context }) {
  const { token } = await getBackendHeaders(context);
  const url = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}auth/`;
  const headers = setHeaders({ token });
  const config = {
    headers: headers,
  };

  const response = await axios.delete(url, config)
    .then((response) => {
      return { status: response?.status, data: response?.data };
    }).catch((error) => {
      const mappedError = mapRequestError(error);
      return { status: mappedError.status, data: mappedError.data };
    });

  return response;
};