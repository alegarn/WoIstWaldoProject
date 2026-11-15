import {
  getUiState,
  publish,
  signalIconTap,
  subscribe,
  resetGroupsIntroUiStoreForTests,
} from '../../utils/groupsIntro/groupsIntroUiStore';

describe('utils/groupsIntro/groupsIntroUiStore', () => {
  beforeEach(() => {
    resetGroupsIntroUiStoreForTests();
  });

  it('exposes the initial state {ringPhase: off, tapCount: 0}', () => {
    expect(getUiState()).toEqual({ ringPhase: 'off', tapCount: 0 });
  });

  it('merges the published patch into state and notifies listeners with the new state', () => {
    const listener = jest.fn();
    subscribe(listener);

    publish({ ringPhase: 'active' });

    expect(getUiState()).toEqual({ ringPhase: 'active', tapCount: 0 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ ringPhase: 'active', tapCount: 0 });
  });

  it('merges partial patches without dropping untouched fields', () => {
    publish({ tapCount: 3 });
    publish({ ringPhase: 'settle' });

    expect(getUiState()).toEqual({ ringPhase: 'settle', tapCount: 3 });
  });

  it('subscribe returns an unsubscribe that removes the listener', () => {
    const listener = jest.fn();
    const unsubscribe = subscribe(listener);
    unsubscribe();

    publish({ tapCount: 1 });

    expect(listener).not.toHaveBeenCalled();
  });

  it('signalIconTap increments tapCount monotonically', () => {
    signalIconTap();
    expect(getUiState().tapCount).toBe(1);

    signalIconTap();
    expect(getUiState().tapCount).toBe(2);

    signalIconTap();
    expect(getUiState().tapCount).toBe(3);
  });

  it('signalIconTap leaves ringPhase untouched', () => {
    publish({ ringPhase: 'active' });

    signalIconTap();

    expect(getUiState()).toEqual({ ringPhase: 'active', tapCount: 1 });
  });

  it('resetGroupsIntroUiStoreForTests restores initial state and clears listeners', () => {
    const listener = jest.fn();
    subscribe(listener);
    publish({ ringPhase: 'settle', tapCount: 5 });

    resetGroupsIntroUiStoreForTests();

    expect(getUiState()).toEqual({ ringPhase: 'off', tapCount: 0 });
    publish({ tapCount: 1 });
    expect(listener).not.toHaveBeenCalled();
  });
});
