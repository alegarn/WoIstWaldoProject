import {
  getSnapshot,
  publish,
  resetGroupHubStore,
  subscribe,
} from '../../services/groups/groupHubStore';

describe('groupHubStore', () => {
  beforeEach(() => {
    resetGroupHubStore();
  });

  afterEach(() => {
    resetGroupHubStore();
  });

  it('starts empty', () => {
    expect(getSnapshot()).toBeNull();
  });

  it('publish stores the identityKey, the data and an updatedAt timestamp', () => {
    const before = Date.now();
    const data = { owned: [{ id: 'g-1' }], joined: [] };

    publish('token-a|user-a', data);

    const snapshot = getSnapshot();
    expect(snapshot.identityKey).toBe('token-a|user-a');
    expect(snapshot.data).toEqual(data);
    expect(snapshot.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it('getSnapshot returns the latest published snapshot (last write wins)', () => {
    publish('token-a|user-a', { owned: [], joined: [] });
    const second = { owned: [{ id: 'g-2' }], joined: [] };

    publish('token-a|user-a', second);

    expect(getSnapshot().data).toEqual(second);
  });

  it('notifies subscribers with the published snapshot and stops after unsubscribe', () => {
    const listener = jest.fn();
    const unsubscribe = subscribe(listener);

    const first = { owned: [{ id: 'g-1' }], joined: [] };
    publish('token-a|user-a', first);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(getSnapshot());

    unsubscribe();

    publish('token-a|user-a', { owned: [{ id: 'g-2' }], joined: [] });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps identity isolation: the snapshot always carries the identity it was published for', () => {
    publish('token-a|user-a', { owned: [{ id: 'g-a' }], joined: [] });
    publish('token-b|user-b', { owned: [{ id: 'g-b' }], joined: [] });

    const snapshot = getSnapshot();
    expect(snapshot.identityKey).toBe('token-b|user-b');
    expect(snapshot.data).toEqual({ owned: [{ id: 'g-b' }], joined: [] });

    publish('token-a|user-a', { owned: [{ id: 'g-a2' }], joined: [] });
    expect(getSnapshot().identityKey).toBe('token-a|user-a');
    expect(getSnapshot().data).toEqual({ owned: [{ id: 'g-a2' }], joined: [] });
  });

  it('resetGroupHubStore clears the snapshot and detaches all listeners', () => {
    const listener = jest.fn();
    const unsubscribe = subscribe(listener);
    publish('token-a|user-a', { owned: [], joined: [] });
    expect(getSnapshot()).not.toBeNull();

    resetGroupHubStore();

    expect(getSnapshot()).toBeNull();
    publish('token-a|user-a', { owned: [], joined: [] });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });
});
