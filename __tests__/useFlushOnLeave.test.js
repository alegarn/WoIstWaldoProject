jest.mock('../utils/sessionScoreStore', () => ({
  flush: jest.fn().mockResolvedValue({ ok: true, sent: 0, retained: 0 }),
}));

import React from 'react';
import { act, create } from 'react-test-renderer';

import { useFlushOnLeave } from '../hooks/useFlushOnLeave';
import { flush as mockedFlush } from '../utils/sessionScoreStore';

function buildMockNavigation() {
  const listeners = {};
  const removed = jest.fn();

  const navigation = {
    addListener: jest.fn((event, cb) => {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event].push(cb);

      return () => {
        removed(event);
        listeners[event] = listeners[event].filter((existing) => existing !== cb);
      };
    }),
  };

  navigation.__emit = (event) => {
    (listeners[event] || []).forEach((cb) => cb());
  };
  navigation.__removed = removed;

  return navigation;
}

function Host({ navigation, authContext }) {
  useFlushOnLeave({ navigation, authContext });
  return null;
}

async function renderHook(navigation, authContext) {
  let renderer;

  await act(async () => {
    renderer = create(<Host navigation={navigation} authContext={authContext} />);
  });

  return renderer;
}

const authContext = { token: 'Bearer token-1', userId: 'user-1' };

describe('useFlushOnLeave', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFlush.mockReset();
    mockedFlush.mockResolvedValue({ ok: true, sent: 0, retained: 0 });
  });

  it('flushes the buffered streak when the screen is removed from the guess-flow stack', async () => {
    const navigation = buildMockNavigation();

    await renderHook(navigation, authContext);

    expect(mockedFlush).not.toHaveBeenCalled();

    await act(async () => {
      navigation.__emit('beforeRemove');
    });

    expect(mockedFlush).toHaveBeenCalledTimes(1);
    expect(mockedFlush).toHaveBeenCalledWith({ authContext });
  });

  it('does not flush on unrelated focus events (e.g. blur)', async () => {
    const navigation = buildMockNavigation();

    await renderHook(navigation, authContext);

    await act(async () => {
      navigation.__emit('blur');
    });

    expect(mockedFlush).not.toHaveBeenCalled();
  });

  it('does not flush merely by mounting', async () => {
    const navigation = buildMockNavigation();

    await renderHook(navigation, authContext);

    expect(mockedFlush).not.toHaveBeenCalled();
  });

  it('removes the beforeRemove subscription when the host unmounts', async () => {
    const navigation = buildMockNavigation();
    const remove = jest.fn();

    navigation.addListener.mockImplementationOnce(() => remove);

    const renderer = await renderHook(navigation, authContext);

    await act(async () => {
      renderer.unmount();
    });

    expect(remove).toHaveBeenCalledTimes(1);
  });
});
