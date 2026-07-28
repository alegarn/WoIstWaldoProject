import { withScopeLock, _debugLocksSize } from '../utils/scopeMutex';

function createDeferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flushMicrotasks = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('utils/scopeMutex', () => {
  afterEach(() => {
    expect(_debugLocksSize()).toBe(0);
  });

  it('resolves with fn value', async () => {
    const result = await withScopeLock('k', () => Promise.resolve('hello'));
    expect(result).toBe('hello');
  });

  it('prior reject does not block next caller (PB3 regression guard)', async () => {
    await expect(
      withScopeLock('k', () => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom');

    const second = await withScopeLock('k', () => Promise.resolve(42));
    expect(second).toBe(42);
  });

  it('concurrent callers same key → serialized (second starts after first settles)', async () => {
    const first = createDeferred<void>();
    const fn1 = jest.fn(() => first.promise);
    const fn2 = jest.fn(() => Promise.resolve('second-done'));

    const call1 = withScopeLock('k', fn1);
    await flushMicrotasks();
    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).toHaveBeenCalledTimes(0);

    const call2 = withScopeLock('k', fn2);
    await flushMicrotasks();
    expect(fn2).toHaveBeenCalledTimes(0);

    first.resolve();
    await call1;

    const result2 = await call2;
    expect(fn2).toHaveBeenCalledTimes(1);
    expect(result2).toBe('second-done');
  });

  it('different keys → parallel (no serialization)', async () => {
    const d1 = createDeferred<void>();
    const d2 = createDeferred<void>();
    const fn1 = jest.fn(() => d1.promise.then(() => 'a'));
    const fn2 = jest.fn(() => d2.promise.then(() => 'b'));

    const call1 = withScopeLock('a', fn1);
    const call2 = withScopeLock('b', fn2);

    await flushMicrotasks();
    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).toHaveBeenCalledTimes(1);

    d1.resolve();
    d2.resolve();
    await expect(call1).resolves.toBe('a');
    await expect(call2).resolves.toBe('b');
  });

  it('rejects when fn rejects (and next caller still proceeds)', async () => {
    await expect(
      withScopeLock('k', () => Promise.reject(new Error('first-fail'))),
    ).rejects.toThrow('first-fail');

    const fn2 = jest.fn(() => Promise.resolve('recovered'));
    const result = await withScopeLock('k', fn2);
    expect(result).toBe('recovered');
    expect(fn2).toHaveBeenCalledTimes(1);
  });

  it('cleans up the lock map after settling (no memory leak)', async () => {
    expect(_debugLocksSize()).toBe(0);
    await withScopeLock('leak-key', () => Promise.resolve(1));
    await withScopeLock('leak-key', () => Promise.reject(new Error('x'))).catch(() => {});
    await flushMicrotasks();
    expect(_debugLocksSize()).toBe(0);
  });
});
