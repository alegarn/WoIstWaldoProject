jest.mock('axios', () => {
  const use = jest.fn();
  return {
    interceptors: {
      response: {
        use,
        eject: jest.fn(),
      },
    },
  };
});

import axios from 'axios';

import {
  installAxiosUnauthorizedHandler,
  isAuthEndpoint,
  setUnauthorizedHandler,
} from '../utils/apiClient';

function getInstalledRejectionHandler() {
  const calls = axios.interceptors.response.use.mock.calls;
  const lastCall = calls[calls.length - 1];

  return lastCall ? lastCall[1] : undefined;
}

describe('utils/apiClient', () => {
  beforeEach(() => {
    setUnauthorizedHandler(null);
  });

  describe('isAuthEndpoint', () => {
    it('flags the sign-in and signup URLs so bad-credential 401s stay ignored', () => {
      expect(isAuthEndpoint('https://api.example/auth/sign_in')).toBe(true);
      expect(isAuthEndpoint('https://api.example/auth')).toBe(true);
    });

    it('does not flag regular api endpoints', () => {
      expect(isAuthEndpoint('https://api.example/api/v1/categories')).toBe(false);
      expect(isAuthEndpoint('https://api.example/api/v1/users/42/get_score_id')).toBe(false);
    });

    it('treats trailing slashes, empty values, and non-strings as non-auth', () => {
      expect(isAuthEndpoint('https://api.example/auth/')).toBe(false);
      expect(isAuthEndpoint('')).toBe(false);
      expect(isAuthEndpoint(null)).toBe(false);
      expect(isAuthEndpoint(undefined)).toBe(false);
      expect(isAuthEndpoint(42)).toBe(false);
    });
  });

  describe('response interceptor', () => {
    it('installs exactly one response interceptor on the default axios instance and stays idempotent', () => {
      const callsBefore = axios.interceptors.response.use.mock.calls.length;

      installAxiosUnauthorizedHandler();
      installAxiosUnauthorizedHandler();

      expect(axios.interceptors.response.use.mock.calls.length).toBe(callsBefore);
      expect(getInstalledRejectionHandler()).toBeDefined();
    });

    it('invokes the registered handler on a non-auth 401 and re-rejects the original error', async () => {
      const handler = jest.fn();
      setUnauthorizedHandler(handler);

      const onRejected = getInstalledRejectionHandler();
      expect(typeof onRejected).toBe('function');

      const error = {
        response: { status: 401 },
        config: { url: 'https://api.example/api/v1/categories' },
      };

      await expect(onRejected(error)).rejects.toEqual(error);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('never invokes the handler for auth endpoint 401s (login and signup stay intact)', async () => {
      const handler = jest.fn();
      setUnauthorizedHandler(handler);

      const onRejected = getInstalledRejectionHandler();

      const signInError = {
        response: { status: 401 },
        config: { url: 'https://api.example/auth/sign_in' },
      };
      const signUpError = {
        response: { status: 401 },
        config: { url: 'https://api.example/auth' },
      };

      await expect(onRejected(signInError)).rejects.toEqual(signInError);
      await expect(onRejected(signUpError)).rejects.toEqual(signUpError);

      expect(handler).not.toHaveBeenCalled();
    });

    it('ignores non-401 errors so regular request failures keep flowing', async () => {
      const handler = jest.fn();
      setUnauthorizedHandler(handler);

      const onRejected = getInstalledRejectionHandler();

      const error = {
        response: { status: 500 },
        config: { url: 'https://api.example/api/v1/categories' },
      };

      await expect(onRejected(error)).rejects.toEqual(error);

      expect(handler).not.toHaveBeenCalled();
    });

    it('still re-rejects when no handler is registered', async () => {
      setUnauthorizedHandler(null);

      const onRejected = getInstalledRejectionHandler();
      const error = {
        response: { status: 401 },
        config: { url: 'https://api.example/api/v1/categories' },
      };

      await expect(onRejected(error)).rejects.toEqual(error);
    });

    it('swallows handler exceptions so the original 401 still propagates to callers', async () => {
      setUnauthorizedHandler(() => {
        throw new Error('handler blew up');
      });

      const onRejected = getInstalledRejectionHandler();
      const error = {
        response: { status: 401 },
        config: { url: 'https://api.example/api/v1/categories' },
      };

      await expect(onRejected(error)).rejects.toEqual(error);
    });
  });
});
