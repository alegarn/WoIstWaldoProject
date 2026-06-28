import axios from 'axios';

let unauthorizedHandler = null;
let isInterceptorInstalled = false;

export function isAuthEndpoint(url) {
  if (typeof url !== 'string' || url === '') {
    return false;
  }

  return url.endsWith('/auth/sign_in') || url.endsWith('/auth');
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
        typeof unauthorizedHandler === 'function'
      ) {
        try {
          unauthorizedHandler();
        } catch (handlerError) {
          // Never mask the original 401 with a handler failure.
        }
      }

      // devise-jwt + JTIMatcher has no refresh-token mechanism: a 401 here means
      // the token was revoked server-side (re-login elsewhere, reseed, etc.) and
      // the user must re-authenticate. No silent refresh is possible.
      return Promise.reject(error);
    }
  );
}

installAxiosUnauthorizedHandler();
