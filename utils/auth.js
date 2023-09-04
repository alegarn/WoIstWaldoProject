import axios from 'axios';

const URL = "https://9992-103-182-81-19.ngrok-free.app/"

async function authenticate({email, password}) {
  const url = `${URL}auth/sign_in`;
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



export async function createUser({ email, password, confirmPassword, username }) {

  const url = `${URL}auth`
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
