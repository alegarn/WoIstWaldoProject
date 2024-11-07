import axios from "axios";
import { getBackendHeaders, setHeaders } from "./auth";

export async function getIsTutorialFinished(context) {
  const { token, uid, expiry, access_token, client, userId } = await getBackendHeaders(context);
  const url = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/users/${userId}/get_is_tutorial_finished`;
  const headers = setHeaders({ token, uid, expiry, access_token, client });
  const config = {
    headers: headers,
  };
  const response = await axios.get(url, config).then((response) => {
    console.log("response getIsTutorialFinished", response.data);
    return {status: response.status, data: response.data };
  }).catch((error) => {
    console.log("error getIsTutorialFinished", error.request);
    return { status: error.request.status, data: error};
  });

  return response;
};

export async function setIsTutorialFinished({ context, data }) {
  const { token, uid, expiry, access_token, client, userId } = await getBackendHeaders(context);
  const url = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/users/${userId}/set_is_tutorial_finished`;
  const headers = setHeaders({ token, uid, expiry, access_token, client });
  const config = {
    headers: headers,
  };
  const response = await axios.put(url, data, config).then((response) => {
    console.log("response setIsTutorialFinished", response.data);
    return {status: response.status, data: response.data };
  }).catch((error) => {
    console.log("error setIsTutorialFinished", error.request);
    return { status: error.request.status, data: error};
  });
};