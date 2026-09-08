import {
  beginSharedFlight,
  getSharedFlight,
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

  it('exposes the shared flight only to callers with the matching identityKey', () => {
    const promise = Promise.resolve('outcome');
    beginSharedFlight('token-a|user-a', promise);

    expect(getSharedFlight('token-a|user-a')?.promise).toBe(promise);
    expect(getSharedFlight('token-b|user-b')).toBeNull();
  });

  it('clears the shared flight once it settles so the next caller starts fresh', async () => {
    beginSharedFlight('token-a|user-a', Promise.resolve('outcome'));

    await Promise.resolve();
    await Promise.resolve();

    expect(getSharedFlight('token-a|user-a')).toBeNull();
  });

  it('keeps only the latest registered flight: a new identity overwrites, and only the registered flight clears itself', async () => {
    let resolveA;
    const promiseA = new Promise((resolve) => { resolveA = resolve; });
    beginSharedFlight('token-a|user-a', promiseA);
    expect(getSharedFlight('token-a|user-a')?.promise).toBe(promiseA);

    const promiseB = Promise.resolve('b');
    beginSharedFlight('token-b|user-b', promiseB);
    expect(getSharedFlight('token-a|user-a')).toBeNull();
    expect(getSharedFlight('token-b|user-b')?.promise).toBe(promiseB);

    await promiseB;
    expect(getSharedFlight('token-b|user-b')).toBeNull();

    resolveA('a');
    await promiseA;
    expect(getSharedFlight('token-a|user-a')).toBeNull();
  });

  it('resetGroupHubStore also drops the shared flight registration', () => {
    beginSharedFlight('token-a|user-a', Promise.resolve('outcome'));

    resetGroupHubStore();

    expect(getSharedFlight('token-a|user-a')).toBeNull();
  });
});
