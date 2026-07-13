const mockStorage = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key) => Promise.resolve(
    Object.prototype.hasOwnProperty.call(mockStorage, key) ? mockStorage[key] : null
  )),
  setItem: jest.fn((key, value) => {
    mockStorage[key] = String(value);
    return Promise.resolve();
  }),
  removeItem: jest.fn((key) => {
    delete mockStorage[key];
    return Promise.resolve();
  }),
}));

jest.mock('../utils/scoreRequests', () => ({
  submitScoreBatch: jest.fn(),
}));

jest.mock('../utils/e2eMode', () => ({
  isE2EMode: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { submitScoreBatch } from '../utils/scoreRequests';
import { isE2EMode } from '../utils/e2eMode';
import {
  bufferScore,
  clearPending,
  flush,
  getPending,
  mintGuessId,
} from '../utils/sessionScoreStore';

const PENDING_KEY = 'pendingScoreEvents';
const drain = () => new Promise((resolve) => setImmediate(resolve));

const item = (overrides) => ({
  guessId: 'g-1',
  pictureId: 'img-1',
  points: 5,
  ...overrides,
});

describe('sessionScoreStore', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
    jest.clearAllMocks();
    isE2EMode.mockReturnValue(false);
    submitScoreBatch.mockResolvedValue(true);
  });

  afterEach(async () => {
    await drain();
  });

  describe('mintGuessId', () => {
    it('returns uuid v4 shaped values that are unique across many calls', () => {
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        const id = mintGuessId();
        expect(id).toMatch(UUID_REGEX);
        ids.add(id);
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('bufferScore', () => {
    it('appends the item and persists under pendingScoreEvents', async () => {
      bufferScore(item({ guessId: 'g-1' }));
      await drain();

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        PENDING_KEY,
        expect.stringContaining('"guessId":"g-1"')
      );
      const stored = await getPending();
      expect(stored).toEqual([expect.objectContaining({ guessId: 'g-1', points: 5 })]);
    });

    it('preserves an explicit ts when provided', async () => {
      bufferScore({ guessId: 'g-2', ts: 12345 });
      await drain();

      const [stored] = await getPending();
      expect(stored.ts).toBe(12345);
    });

    it('stamps the supplied userId on the persisted item', async () => {
      bufferScore(item({ guessId: 'g-uid', userId: 'user-A' }));
      await drain();

      const stored = await getPending();
      expect(stored).toHaveLength(1);
      expect(stored[0]).toEqual(expect.objectContaining({ guessId: 'g-uid', userId: 'user-A' }));
    });
  });

  describe('getPending', () => {
    it('returns the parsed list when storage holds one', async () => {
      mockStorage[PENDING_KEY] = JSON.stringify([{ guessId: 'g-1' }, { guessId: 'g-2' }]);

      expect(await getPending()).toEqual([{ guessId: 'g-1' }, { guessId: 'g-2' }]);
    });

    it('returns an empty list when nothing is stored', async () => {
      expect(await getPending()).toEqual([]);
    });

    it('returns an empty list when storage holds invalid json', async () => {
      mockStorage[PENDING_KEY] = '{bad json';

      expect(await getPending()).toEqual([]);
    });
  });

  describe('clearPending', () => {
    it('removes the pendingScoreEvents key', async () => {
      mockStorage[PENDING_KEY] = JSON.stringify([{ guessId: 'g-1' }]);

      await clearPending();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(PENDING_KEY);
      expect(await getPending()).toEqual([]);
    });
  });

  describe('flush', () => {
    it('returns ok with sent count and clears storage when the adapter succeeds', async () => {
      bufferScore(item({ guessId: 'g-1' }));
      bufferScore(item({ guessId: 'g-2' }));
      await drain();

      submitScoreBatch.mockResolvedValue(true);

      const result = await flush({ authContext: { token: 'Bearer token' } });

      expect(result).toEqual({ ok: true, sent: 2, retained: 0 });
      expect(submitScoreBatch).toHaveBeenCalledTimes(1);
      expect(submitScoreBatch).toHaveBeenCalledWith({
        items: expect.arrayContaining([
          expect.objectContaining({ guessId: 'g-1' }),
          expect.objectContaining({ guessId: 'g-2' }),
        ]),
        context: { token: 'Bearer token' },
      });
      expect(await getPending()).toEqual([]);
    });

    it('returns not-ok with retained count and re-buffers items when the adapter returns false', async () => {
      bufferScore(item({ guessId: 'g-1' }));
      bufferScore(item({ guessId: 'g-2' }));
      await drain();

      submitScoreBatch.mockResolvedValue(false);

      const result = await flush({ authContext: { token: 'Bearer token' } });
      await drain();

      expect(result).toEqual({ ok: false, sent: 0, retained: 2 });
      const retained = await getPending();
      expect(retained).toHaveLength(2);
      expect(retained.map((i) => i.guessId).sort()).toEqual(['g-1', 'g-2']);
    });

    it('treats an adapter rejection as a per-group failure and re-buffers', async () => {
      bufferScore(item({ guessId: 'g-1' }));
      await drain();

      submitScoreBatch.mockRejectedValue(new Error('network down'));

      const result = await flush({ authContext: { token: 'Bearer token' } });
      await drain();

      expect(result).toEqual({ ok: false, sent: 0, retained: 1 });
      expect(await getPending()).toHaveLength(1);
    });

    it('short-circuits in e2e mode without calling the adapter and clears the buffer', async () => {
      bufferScore(item({ guessId: 'g-1' }));
      await drain();

      isE2EMode.mockReturnValue(true);

      const result = await flush({ authContext: { token: 'Bearer token' } });

      expect(result).toEqual({ ok: true, sent: 0, retained: 0 });
      expect(submitScoreBatch).not.toHaveBeenCalled();
      expect(await getPending()).toEqual([]);
    });

    it('splits a mixed buffer into public and per-group private buckets', async () => {
      bufferScore(item({ guessId: 'pub-1' }));
      bufferScore(item({ guessId: 'pub-2' }));
      bufferScore(item({
        guessId: 'priv-1',
        scope: { kind: 'private', groupId: 'g-9' },
      }));
      await drain();

      submitScoreBatch.mockResolvedValue(true);

      const result = await flush({ authContext: { token: 'Bearer token' } });

      expect(result).toEqual({ ok: true, sent: 3, retained: 0 });
      expect(submitScoreBatch).toHaveBeenCalledTimes(2);

      const calls = submitScoreBatch.mock.calls.map((args) => args[0]);
      const publicCall = calls.find((args) => args.items.every((i) => !i.scope));
      const privateCall = calls.find((args) => args.items.every((i) => i.scope && i.scope.kind === 'private'));

      expect(publicCall.items).toHaveLength(2);
      expect(privateCall.items).toHaveLength(1);
      expect(privateCall.items[0].scope.groupId).toBe('g-9');
      expect(privateCall.context).toEqual({ token: 'Bearer token' });
    });

    it('coalesces concurrent flush calls into a single adapter invocation', async () => {
      bufferScore(item({ guessId: 'g-1' }));
      await drain();

      let resolveAdapter;
      submitScoreBatch.mockImplementationOnce(
        () => new Promise((resolve) => { resolveAdapter = resolve; })
      );

      const p1 = flush({ authContext: { token: 'Bearer token' } });
      const p2 = flush({ authContext: { token: 'Bearer token' } });

      try {
        await drain();
        expect(submitScoreBatch).toHaveBeenCalledTimes(1);
      } finally {
        if (resolveAdapter) resolveAdapter(true);
      }

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toEqual({ ok: true, sent: 1, retained: 0 });
      expect(r2).toEqual(r1);
    });

    it('serializes concurrent bufferScore calls so every event is persisted', async () => {
      for (let i = 0; i < 5; i++) {
        bufferScore(item({ guessId: `g-${i}`, points: i }));
      }
      await drain();

      const stored = await getPending();
      expect(stored).toHaveLength(5);
      expect(stored.map((i) => i.guessId).sort()).toEqual(['g-0', 'g-1', 'g-2', 'g-3', 'g-4']);
    });

    it('clears pendingScoreEvents before sending while the adapter promise is pending', async () => {
      bufferScore(item({ guessId: 'g-1' }));
      await drain();

      let resolveAdapter;
      submitScoreBatch.mockImplementationOnce(
        () => new Promise((resolve) => { resolveAdapter = resolve; })
      );

      const flushPromise = flush({ authContext: { token: 'Bearer token' } });

      try {
        await drain();
        expect(await getPending()).toEqual([]);
        expect(AsyncStorage.setItem).toHaveBeenCalledWith(PENDING_KEY, '[]');
      } finally {
        if (resolveAdapter) resolveAdapter(true);
      }

      await flushPromise;
    });

    it('preserves a late buffered event when an interleaved flush fails its snapshot', async () => {
      bufferScore(item({ guessId: 'snap-A' }));
      await drain();

      let resolveAdapter;
      submitScoreBatch.mockImplementationOnce(
        () => new Promise((resolve) => { resolveAdapter = resolve; })
      );

      const flushPromise = flush({ authContext: { token: 'Bearer token' } });

      try {
        await drain();
        bufferScore(item({ guessId: 'late-B', points: 9 }));
      } finally {
        if (resolveAdapter) resolveAdapter(false);
      }

      await flushPromise;
      await drain();

      const retained = await getPending();
      const ids = retained.map((i) => i.guessId);
      expect(ids).toContain('snap-A');
      expect(ids).toContain('late-B');
    });

    it('returns ok with zero sent when nothing is buffered', async () => {
      const result = await flush({ authContext: { token: 'Bearer token' } });

      expect(result).toEqual({ ok: true, sent: 0, retained: 0 });
      expect(submitScoreBatch).not.toHaveBeenCalled();
    });

    it('sends only items owned by the current user and keeps others in storage', async () => {
      bufferScore(item({ guessId: 'a-1', userId: 'user-A' }));
      bufferScore(item({ guessId: 'a-2', userId: 'user-A' }));
      bufferScore(item({ guessId: 'b-1', userId: 'user-B' }));
      await drain();

      submitScoreBatch.mockResolvedValue(true);

      const result = await flush({ authContext: { token: 'Bearer token', userId: 'user-B' } });

      expect(result).toEqual({ ok: true, sent: 1, retained: 0 });
      expect(submitScoreBatch).toHaveBeenCalledTimes(1);
      expect(submitScoreBatch).toHaveBeenCalledWith({
        items: [expect.objectContaining({ guessId: 'b-1', userId: 'user-B' })],
        context: { token: 'Bearer token', userId: 'user-B' },
      });

      const remaining = await getPending();
      expect(remaining.map((i) => i.guessId).sort()).toEqual(['a-1', 'a-2']);
      expect(remaining.every((i) => i.userId === 'user-A')).toBe(true);
    });

    it('flushes legacy items without userId (backward-compatible == null path)', async () => {
      bufferScore(item({ guessId: 'legacy-1' }));
      bufferScore(item({ guessId: 'a-1', userId: 'user-A' }));
      await drain();

      submitScoreBatch.mockResolvedValue(true);

      const result = await flush({ authContext: { token: 'Bearer token', userId: 'user-B' } });

      expect(result).toEqual({ ok: true, sent: 1, retained: 0 });
      expect(submitScoreBatch).toHaveBeenCalledTimes(1);
      expect(submitScoreBatch).toHaveBeenCalledWith({
        items: [expect.objectContaining({ guessId: 'legacy-1' })],
        context: { token: 'Bearer token', userId: 'user-B' },
      });

      const remaining = await getPending();
      expect(remaining.map((i) => i.guessId)).toEqual(['a-1']);
    });

    it('returns ok with zero sent and retains others when only others are buffered', async () => {
      bufferScore(item({ guessId: 'a-1', userId: 'user-A' }));
      await drain();

      const result = await flush({ authContext: { token: 'Bearer token', userId: 'user-B' } });

      expect(result).toEqual({ ok: true, sent: 0, retained: 1 });
      expect(submitScoreBatch).not.toHaveBeenCalled();
      expect((await getPending()).map((i) => i.guessId)).toEqual(['a-1']);
    });

    it('on flush failure re-buffers only the owned items sent in that attempt, leaving others untouched', async () => {
      bufferScore(item({ guessId: 'a-1', userId: 'user-A' }));
      bufferScore(item({ guessId: 'b-1', userId: 'user-B' }));
      await drain();

      submitScoreBatch.mockResolvedValue(false);

      const result = await flush({ authContext: { token: 'Bearer token', userId: 'user-B' } });
      await drain();

      expect(result).toEqual({ ok: false, sent: 0, retained: 1 });
      expect(submitScoreBatch).toHaveBeenCalledTimes(1);
      expect(submitScoreBatch).toHaveBeenCalledWith({
        items: [expect.objectContaining({ guessId: 'b-1', userId: 'user-B' })],
        context: { token: 'Bearer token', userId: 'user-B' },
      });

      const remaining = await getPending();
      expect(remaining.map((i) => i.guessId).sort()).toEqual(['a-1', 'b-1']);
      const aItem = remaining.find((i) => i.guessId === 'a-1');
      expect(aItem.userId).toBe('user-A');
    });
  });
});
