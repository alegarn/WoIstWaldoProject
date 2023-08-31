import axios from 'axios';


/* const API_KEY = "";
const ACCESS_TOKEN = "9UDAGNAEhhhQvgh0g0POqQ";
const BEARER_TOKEN = "eyJhY2Nlc3MtdG9rZW4iOiI5VURBR05BRWhoaFF2Z2gwZzBQT3FRIiwidG9rZW4tdHlwZSI6IkJlYXJlciIsImNsaWVudCI6InUycTdmVUVYNTdlWE5FQy10dkFSMnciLCJleHBpcnkiOiIxNjkwNzcwNzA5IiwidWlkIjoiYTNAYS5jb20ifQ";
const TOKEN_TYPE = "Bearer"; */
// Expiry : 1690770709
// Uid : email
const URL = "https://d5a3-103-182-81-23.ngrok-free.app/"

async function authenticate({email, password}) {
  const url = `${URL}auth/sign_in`;
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    //'Authorization': `${token}`,
    //'Authorization': `Bearer ${ACCESS_TOKEN}`,
    //"token-type": `Bearer`,
    //"access-token": `${access_token}`,
    // "access-token": ACCESS_TOKEN,
    //"expiry": expiry,
    //"expiry": 1690770709,
    "uid": email,
//    'Host': 'exp://192.168.1.18:8081',
  };
  const data = {
    'email': email,
    'password': password,
//    'confirm_success_url': "exp://192.168.1.18:8081",
  };
  const response = await axios.post(url, data, headers).then((response) => {
    /* console.log("response ", response);
    console.log("expiry", response.headers.expiry);
    console.log(response.headers['token-type']);
    console.log(response.headers.uid);
    console.log(response.headers.authorization);
    console.log(response.headers['access-token']);
    console.log(response.headers.client);
    console.log("authenticate"); */

    return response;
  }).catch((error) => {
    console.log("error", error);
    return error;
  });
  console.log("response authenticate", response);
  return response;
}



export async function createUser({ email, password, confirmPassword, username }) {

  const url = `${URL}auth`
//  const url = `.../create_user?api_key=${API_KEY}`;
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
//    'Host': 'exp://192.168.1.18:8081',
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
/*     console.log("response", response);
    console.log(response.headers.expiry);
    console.log("token-type", response.headers['token-type']);
    console.log("uid", response.headers.uid);
    console.log("authorization", response.headers.authorization);
    console.log("access-token", response.headers['access-token']);
 */
    token = response.headers.authorization;
    status = response.status;
    expiry = response.headers.expiry;
    access_token = response.headers['access-token'];

    console.log("token", token);
    console.log("expiry", expiry);
    console.log("access_token", access_token);

//    console.log("response create_user", response);

    return {response, status, token, expiry, access_token};
  })
    .catch((error) => {
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

// a4@a.com
