import axios from "axios";
import { getBackendHeaders } from "./auth";
import { setHeaders } from "./auth";

export async function updateUserScore({ score, pictureId, context }) {
  const { token, uid, expiry, access_token, client, userId, scoreId } = await getBackendHeaders(context);
  const url = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/users/${userId}/scores/${scoreId}`;
  const headers = setHeaders({ token, uid, expiry, access_token, client });
  const config = {
    headers: headers,
  };
  const requestData = {
    score: {
      score: score,
      image_name: pictureId
    },
  };

  const response = axios
    .put(url, requestData, config)
    .then((response) => {
      return { status: 200, message: response };
    })
    .catch((error) => {
      return {
        status: error.request.status,
        message: error.message,
      }
    })
  return response;
};

export async function getRankingData(context) {
  const { token, uid, expiry, access_token, client, userId } = await getBackendHeaders(context);
  const url = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/users/${userId}/scores`;
  const headers = setHeaders({ token, uid, expiry, access_token, client });
  const config = {
    headers: headers,
  };
  const response = await axios.get(url, config).then((response) => {
    return { status: response.status, data: response.data };
  })
  .catch((error) => {
    return { status: error.request.status, message: error.message };
  });
  return response;
};

export async function getUserScores({username, context}) {
  const { token, uid, expiry, access_token, client, userId } = await getBackendHeaders(context);
  const url = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/users/${userId}/get_user_scores?username=${username}`;
  const headers = setHeaders({ token, uid, expiry, access_token, client });
  const config = {
    headers: headers,
  };
  const response = await axios.get(url, config).then((response) => {
    return { status: response.status, data: response.data };
  })
  .catch((error) => {
    return { status: error.request.status, message: error.message };
  });
  return response;
};
