const locks = new Map<string, Promise<unknown>>();

export function withScopeLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prior = locks.get(key) ?? Promise.resolve();
  const next = prior.catch(() => {}).then(() => fn());
  locks.set(key, next);
  next
    .finally(() => {
      if (locks.get(key) === next) locks.delete(key);
    })
    .catch(() => {});
  return next;
}

export function _debugLocksSize(): number {
  return locks.size;
}
