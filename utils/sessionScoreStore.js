import AsyncStorage from '@react-native-async-storage/async-storage';
import { submitScoreBatch } from './scoreRequests';
import { isE2EMode } from './e2eMode';

const PENDING_SCORE_EVENTS_KEY = 'pendingScoreEvents';

let writeChain = Promise.resolve();
let flushing = false;
let pendingFlush = null;

function groupByScope(items) {
  const publicBucket = [];
  const privateGroups = new Map();

  for (const item of items) {
    const scope = item && item.scope;
    if (scope && scope.kind === 'private' && scope.groupId) {
      const key = scope.groupId;
      if (!privateGroups.has(key)) {
        privateGroups.set(key, []);
      }
      privateGroups.get(key).push(item);
    } else {
      publicBucket.push(item);
    }
  }

  const groups = [];
  if (publicBucket.length > 0) {
    groups.push(publicBucket);
  }
  for (const group of privateGroups.values()) {
    groups.push(group);
  }
  return groups;
}

export function mintGuessId() {
  const fillRandom = (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function')
    ? (bytes) => crypto.getRandomValues(bytes)
    : (bytes) => {
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
      return bytes;
    };

  const bytes = new Uint8Array(16);
  fillRandom(bytes);

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));

  return (
    hex.slice(0, 4).join('') +
    '-' +
    hex.slice(4, 6).join('') +
    '-' +
    hex.slice(6, 8).join('') +
    '-' +
    hex.slice(8, 10).join('') +
    '-' +
    hex.slice(10, 16).join('')
  );
}

async function readList() {
  const stored = await AsyncStorage.getItem(PENDING_SCORE_EVENTS_KEY);
  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeList(items) {
  await AsyncStorage.setItem(PENDING_SCORE_EVENTS_KEY, JSON.stringify(items));
}

function mutateList(fn) {
  writeChain = writeChain.then(async () => {
    const list = await readList();
    const next = await fn(list);
    await writeList(next === undefined ? list : next);
  });
  return writeChain;
}

export function bufferScore(item) {
  const normalized = item && typeof item === 'object'
    ? { ...item, ts: item.ts ?? Date.now() }
    : item;

  writeChain = mutateList((list) => {
    list.push(normalized);
  }).catch(() => {});

  return writeChain;
}

export async function getPending() {
  return await readList();
}

export async function clearPending() {
  await AsyncStorage.removeItem(PENDING_SCORE_EVENTS_KEY);
}

export async function flush({ authContext }) {
  if (isE2EMode()) {
    writeChain = writeChain.then(async () => {
      await clearPending();
    });
    await writeChain;
    return { ok: true, sent: 0, retained: 0 };
  }

  if (flushing) {
    return pendingFlush;
  }

  flushing = true;

  pendingFlush = (async () => {
    let result = { ok: true, sent: 0, retained: 0 };

    try {
      writeChain = writeChain
        .then(async () => {
          const items = await readList();
          if (!items || items.length === 0) {
            result = { ok: true, sent: 0, retained: 0 };
            return;
          }

          const currentUserId = authContext?.userId;
          const owned = (item) => item.userId == null || item.userId === currentUserId;
          const mine = items.filter(owned);
          const others = items.filter((item) => !owned(item));

          if (mine.length === 0) {
            result = { ok: true, sent: 0, retained: others.length };
            return;
          }

          await writeList(others);

          const groups = groupByScope(mine);

          let sent = 0;
          let retained = 0;
          let allOk = true;

          for (const group of groups) {
            let ok = false;
            try {
              ok = await submitScoreBatch({ items: group, context: authContext });
            } catch {
              ok = false;
            }
            if (ok) {
              sent += group.length;
            } else {
              allOk = false;
              retained += group.length;
              const reBufferItems = group.slice();
              writeChain = mutateList((list) => {
                for (const item of reBufferItems) {
                  list.push(item);
                }
              }).catch(() => {});
            }
          }

          result = { ok: allOk, sent, retained };
        })
        .catch(() => {
          result = { ok: false, sent: 0, retained: 0 };
        });

      await writeChain;
      return result;
    } finally {
      flushing = false;
      pendingFlush = null;
    }
  })();

  return pendingFlush;
}
