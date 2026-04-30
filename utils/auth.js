import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const AUTH_STORAGE_KEYS = ['token', 'uid', 'expiry', 'access_token', 'client', 'userId'];
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
  const { token, uid, expiry, access_token, client, userId } = await getStoredAuthState();
  return { token, uid, expiry, access_token, client, userId };
};

export async function getBackendHeadersFromContext(context) {
  const { token, uid, expiry, access_token, client, userId } = context;
  return { token, uid, expiry, access_token, client, userId };
};

export async function getBackendHeaders(context) {
  const contextHeaders = await getBackendHeadersFromContext(context);

  if (hasCompleteAuthState(contextHeaders)) {
    return contextHeaders;
  };

  return await getBackendHeadersFromStorage();
};

export function setHeaders({ token, uid, expiry, access_token, client }) {
  const headers = {
    Authorization: token,
    HTTP_AUTHORIZATION: token,
    "access-token": access_token,
    client: client,
    expiry: expiry,
    uid: uid,
    "token-type": "Bearer",
    "Content-Type": "application/json;charset=UTF-8",
    Accept: "*/*",
  };
  return headers;
};


async function authenticateUser({ email, password }) {
  const url = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}auth/sign_in`;
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    "uid": email,
  };
  const data = {
    'email': email,
    'password': password,
  };
  
  const response = await axios.post(url, data, headers)
    .then((response) => {
      return response;
    }).catch((error) => {
      console.log("error authenticateUser", error.request);
      console.log("error", error);
      return error;
    });
  
  console.log("response authenticateUser", response);
  
  return response;
};

export async function getScoreId(context) {
  const { token, uid, expiry, access_token, client, userId } = await getBackendHeaders(context);
  const url = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/users/${userId}/get_score_id`;
  const headers = setHeaders({ token, uid, expiry, access_token, client });
  const config = {
    headers: headers,
  };

  const response = await axios.get(url, config).then((response) => {
    return {status: response.status, data: response.data };
  }).catch((error) => {
    console.log("error getScoreId", error.request);
    return { status: error.request.status, data: error};
  });

  return response;
};

export async function createUser({ email, password, confirmPassword, username }) {

  const url = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}auth`
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  console.log("email", email, password, confirmPassword);

  const data = {
    'username': username,
    'email': email,
    'password': password,
    'password_confirmation': confirmPassword,
    'confirm_success_url': "exp://192.168.1.18:8081",
  };

  let token = "";
  let status = 0;
  let expiry = '';
  let access_token = "";

  const response = await axios.post(url, data, headers).then((response) => {

    token = response.headers.authorization;
    status = response.status;
    expiry = response.headers.expiry;
    access_token = response.headers['access-token'];

    console.log("token", token);
    console.log("expiry", expiry);
    console.log("access_token", access_token);

    return {response, status, token, expiry, access_token};
  }).catch((error) => {
    console.log(error);
    status = error.response.status;
    return {response, status, token, expiry, access_token};
  });

  console.log("response create_user", response);

  return response;
};

export async function login({email, password}) {
  return await authenticateUser({email, password});
};


/* export async function logout({ context }) {
  const { token, uid, expiry, access_token, client } = await getBackendHeaders(context);
  const url = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}auth/sign_out`;
  const headers = setHeaders({ token, uid, expiry, access_token, client });
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
  const { token, uid, expiry, access_token, client, userId } = await getBackendHeaders(context);
  const url = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/users/${userId}/get_user_name`;
  const headers = setHeaders({ token, uid, expiry, access_token, client });
  const config = {
    headers: headers,
  };

  const response = await axios.get(url, config).then((response) => {
    console.log("response getUserName", response.data);
    return { status: response.status, data: response.data };
  }).catch((error) => {
    console.log("error getUsername", error.request);
    return { status: error.request.status, data: error};
  });

  return response;
};

export async function updateUser({ context, data }) {
  const { token, uid, expiry, access_token, client } = await getBackendHeaders(context);
  const url = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}auth/`;
  const headers = setHeaders({ token, uid, expiry, access_token, client });
  const config = {
    headers: headers,
  };

  const response = await axios.put(url, data, config).then((response) => {
    console.log("response updateUser", response.data);
    return { status: response.status, data: response.data.data };
  }).catch((error) => {
    console.log("error updateUser", error.request);
    return { status: error.request.status, data: error };
  });
  return response;
};

export async function deleteAccount({ context }) {
  const { token, uid, expiry, access_token, client, userId } = await getBackendHeaders(context);
  const url = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}auth/`;
  const headers = setHeaders({ token, uid, expiry, access_token, client });
  const config = {
    headers: headers,
  };

  const response = await axios.delete(url, config)
    .then((response) => {
      console.log("response deleteAccount", response?.data);
      return { status: response?.status, data: response?.data };
    }).catch((error) => {
      console.log("error deleteAccount", error?.request);
      return { status: error?.request?.status, data: error };
    });
  return response;
};