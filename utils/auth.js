import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

export async function getBackendHeaders() {
  const token = await SecureStore.getItemAsync("token");
  const uid = await SecureStore.getItemAsync("uid");
  const expiry = await SecureStore.getItemAsync("expiry");
  const access_token = await SecureStore.getItemAsync("access_token");
  const client = await SecureStore.getItemAsync("client");
  const userId = await SecureStore.getItemAsync("userId");
  return { token, uid, expiry, access_token, client, userId };
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


async function authenticate({email, password}) {
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
  const response = await axios.post(url, data, headers).then((response) => {

    return response;
  }).catch((error) => {
    console.log("error", error);
    return error;
  });
  console.log("response authenticate", response);
  return response;
};

export async function getScoreId() {
  const { token, uid, expiry, access_token, client, userId } = await getBackendHeaders();
  const url = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/users/${userId}/get_score_id`;
  const headers = setHeaders({ token, uid, expiry, access_token, client });
  const config = {
    headers: headers,
  };
  const response = await axios.get(url, config).then((response) => {
    return {status: response.status, data: response.data };
  }).catch((error) => {
    console.log("error getScoreId", error);

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
  return await authenticate({email, password});
};


