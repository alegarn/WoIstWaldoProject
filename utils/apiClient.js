import axios from 'axios';

let unauthorizedHandler = null;
let isInterceptorInstalled = false;

export function isAuthEndpoint(url) {
  if (typeof url !== 'string' || url === '') {
    return false;
  }

  return url.endsWith('/auth/sign_in') || url.endsWith('/auth');
}

export function isImageStorageEndpoint(url) {
  if (typeof url !== 'string' || url === '') {
    return false;
  }

  return url.includes('/local_image_storage/');
}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === 'function' ? handler : null;
}

export function installAxiosUnauthorizedHandler() {
  if (isInterceptorInstalled) {
    return;
  }

  isInterceptorInstalled = true;

  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      const status = error?.response?.status;
      const requestUrl = error?.config?.url;

      if (
        status === 401 &&
        !isAuthEndpoint(requestUrl) &&
        !isImageStorageEndpoint(requestUrl) &&
        typeof unauthorizedHandler === 'function'
      ) {
        try {
          unauthorizedHandler();
        } catch (handlerError) {
          // Never mask the original 401 with a handler failure.
        }
      }

      return Promise.reject(error);
    }
  );
}

installAxiosUnauthorizedHandler();
