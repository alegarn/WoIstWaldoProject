jest.mock('../services/cardDeck', () => ({
  fetchCardBatch: jest.fn(),
  appendCardBatch: jest.fn(),
}));
jest.mock('../utils/storageDatum', () => ({
  getDeckCountForScope: jest.fn(),
}));
jest.mock('../utils/e2eMode', () => ({ isE2EMode: jest.fn(() => false) }));

import { fetchCardBatch, appendCardBatch } from '../services/cardDeck';
import { getDeckCountForScope } from '../utils/storageDatum';
import { isE2EMode } from '../utils/e2eMode';
import {
  LOW_CARD_THRESHOLD,
  ALL_WARM_THRESHOLD,
  prefetchIfLow,
  warmAllDeckIfNeeded,
  __resetForTests,
} from '../services/cardPrefetcher';

const fetchMock = fetchCardBatch as jest.MockedFunction<typeof fetchCardBatch>;
const appendMock = appendCardBatch as jest.MockedFunction<typeof appendCardBatch>;
const countMock = getDeckCountForScope as jest.MockedFunction<typeof getDeckCountForScope>;
const e2eMock = isE2EMode as jest.MockedFunction<typeof isE2EMode>;

const IMAGES = [{ listId: 1 }, { listId: 2 }, { listId: 3 }];

function okResponse(images = IMAGES) {
  return Promise.resolve({ isError: false, images });
}

describe('cardPrefetcher', () => {
  beforeEach(() => {
    __resetForTests();
    jest.clearAllMocks();
    e2eMock.mockReturnValue(false);
    countMock.mockResolvedValue(0);
    fetchMock.mockResolvedValue({ isError: false, images: IMAGES } as never);
    appendMock.mockResolvedValue(null as never);
  });

  it('exports thresholds equal to 5', () => {
    expect(LOW_CARD_THRESHOLD).toBe(5);
    expect(ALL_WARM_THRESHOLD).toBe(5);
  });

  it('does not fetch when count >= LOW_CARD_THRESHOLD', async () => {
    countMock.mockResolvedValue(7);

    await prefetchIfLow({ categoryKey: 'city', categoryId: 7, language: 'fr', scope: { kind: 'public' }, authContext: {} });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(appendMock).not.toHaveBeenCalled();
  });

  it('fetches and appends when count < LOW_CARD_THRESHOLD', async () => {
    countMock.mockResolvedValue(3);

    await prefetchIfLow({ categoryKey: 'all', language: 'fr', scope: { kind: 'public' }, authContext: { token: 'x' } });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith({
      categoryKey: 'all',
      categoryId: undefined,
      language: 'fr',
      scope: { kind: 'public' },
      authContext: { token: 'x' },
    });
    expect(appendMock).toHaveBeenCalledTimes(1);
    expect(appendMock).toHaveBeenCalledWith({
      cards: IMAGES,
      categoryKey: 'all',
      categoryId: undefined,
      language: 'fr',
      scope: { kind: 'public' },
    });
  });

  it('skips append when fetchCardBatch returns isError', async () => {
    countMock.mockResolvedValue(3);
    fetchMock.mockResolvedValue({ isError: true } as never);

    await expect(
      prefetchIfLow({ categoryKey: 'city', categoryId: 7, language: 'fr', scope: { kind: 'public' }, authContext: {} }),
    ).resolves.toBeUndefined();

    expect(appendMock).not.toHaveBeenCalled();
  });

  it('swallows errors from fetchCardBatch', async () => {
    countMock.mockResolvedValue(3);
    fetchMock.mockRejectedValue(new Error('network down') as never);

    await expect(
      prefetchIfLow({ categoryKey: 'city', categoryId: 7, language: 'fr', scope: { kind: 'public' }, authContext: {} }),
    ).resolves.toBeUndefined();

    expect(appendMock).not.toHaveBeenCalled();
  });

  it('dedups concurrent calls for the same deck key (one fetchCardBatch total)', async () => {
    countMock.mockResolvedValue(3);
    fetchMock.mockImplementation(okResponse);

    const a = prefetchIfLow({ categoryKey: 'all', language: 'fr', scope: { kind: 'public' }, authContext: {} });
    const b = prefetchIfLow({ categoryKey: 'all', language: 'fr', scope: { kind: 'public' }, authContext: {} });

    await Promise.all([a, b]);
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('allows a new prefetch after the in-flight promise resolves (dedup cleared)', async () => {
    countMock.mockResolvedValue(3);
    fetchMock.mockImplementation(okResponse);

    await prefetchIfLow({ categoryKey: 'all', language: 'fr', scope: { kind: 'public' }, authContext: {} });
    await Promise.resolve();
    await prefetchIfLow({ categoryKey: 'all', language: 'fr', scope: { kind: 'public' }, authContext: {} });
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('warms the "all" deck in addition to the category fetch when categoryKey !== "all" and count is low', async () => {
    countMock.mockResolvedValueOnce(3).mockResolvedValueOnce(0);
    fetchMock.mockImplementation((params) =>
      okResponse((params as { categoryKey: string }).categoryKey === 'all' ? [{ listId: 100 }] : IMAGES),
    );

    await prefetchIfLow({ categoryKey: 'city', categoryId: 7, language: 'fr', scope: { kind: 'public' }, authContext: {} });
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const allCall = fetchMock.mock.calls.find((c) => c[0]?.categoryKey === 'all');
    expect(allCall).toBeDefined();
    expect(allCall![0]).toMatchObject({ categoryKey: 'all', language: 'fr' });

    const allAppend = appendMock.mock.calls.find((c) => c[0]?.categoryKey === 'all');
    expect(allAppend).toBeDefined();
    expect(allAppend![0]).toMatchObject({ cards: [{ listId: 100 }], categoryKey: 'all' });
  });

  it('does not re-warm while the persisted "all" deck still has cards', async () => {
    countMock.mockResolvedValueOnce(0).mockResolvedValueOnce(2);
    fetchMock.mockImplementation(() => okResponse());

    await warmAllDeckIfNeeded({ language: 'fr', scope: { kind: 'public' }, authContext: {} });
    await warmAllDeckIfNeeded({ language: 'fr', scope: { kind: 'public' }, authContext: {} });

    const allCalls = fetchMock.mock.calls.filter((c) => c[0]?.categoryKey === 'all');
    expect(allCalls).toHaveLength(1);
    expect(appendMock).toHaveBeenCalledTimes(1);
  });

  it('cold-starts the all-deck warm from the head when the persisted all deck is empty', async () => {
    countMock.mockResolvedValueOnce(0);
    fetchMock.mockImplementation(() => okResponse());

    await warmAllDeckIfNeeded({ language: 'fr', scope: { kind: 'public' }, authContext: {} });

    expect(fetchMock).toHaveBeenCalledWith({
      categoryKey: 'all',
      language: 'fr',
      scope: { kind: 'public' },
      authContext: {},
      pictureIdOverride: null,
    });
  });

  it('does not warm when categoryKey === "all"', async () => {
    countMock.mockResolvedValue(3);
    fetchMock.mockImplementation(okResponse);

    await prefetchIfLow({ categoryKey: 'all', language: 'fr', scope: { kind: 'public' }, authContext: {} });
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toMatchObject({ categoryKey: 'all' });
  });

  it('is a no-op in e2e mode (prefetchIfLow)', async () => {
    e2eMock.mockReturnValue(true);

    await prefetchIfLow({ categoryKey: 'city', categoryId: 7, language: 'fr', scope: { kind: 'public' }, authContext: {} });

    expect(countMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(appendMock).not.toHaveBeenCalled();
  });

  it('is a no-op in e2e mode (warmAllDeckIfNeeded)', async () => {
    e2eMock.mockReturnValue(true);

    await warmAllDeckIfNeeded({ language: 'fr', scope: { kind: 'public' }, authContext: {} });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(appendMock).not.toHaveBeenCalled();
  });

  it('warm-all retries on failure', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error('net down') as never));

    await warmAllDeckIfNeeded({ language: 'fr', scope: { kind: 'public' }, authContext: {} });

    fetchMock.mockImplementation(() => okResponse());

    await warmAllDeckIfNeeded({ language: 'fr', scope: { kind: 'public' }, authContext: {} });

    const allCalls = fetchMock.mock.calls.filter((c) => c[0]?.categoryKey === 'all');
    expect(allCalls).toHaveLength(2);
    expect(appendMock).toHaveBeenCalledTimes(1);
  });

  it('warm-all is awaitable and shares in-flight promise across concurrent callers', async () => {
    fetchMock.mockImplementation(() => okResponse());

    const p = warmAllDeckIfNeeded({ language: 'fr', scope: { kind: 'public' }, authContext: {} });
    expect(p).toBeInstanceOf(Promise);

    const p2 = warmAllDeckIfNeeded({ language: 'fr', scope: { kind: 'public' }, authContext: {} });

    await Promise.all([p, p2]);

    const allCalls = fetchMock.mock.calls.filter((c) => c[0]?.categoryKey === 'all');
    expect(allCalls).toHaveLength(1);
  });

  it('warm-all fetches again when the persisted all deck drains back to zero', async () => {
    countMock.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    fetchMock.mockImplementation(() => okResponse());

    await warmAllDeckIfNeeded({ language: 'fr', scope: { kind: 'public' }, authContext: {} });
    expect(appendMock).toHaveBeenCalledTimes(1);

    await warmAllDeckIfNeeded({ language: 'fr', scope: { kind: 'public' }, authContext: {} });

    const allCalls = fetchMock.mock.calls.filter((c) => c[0]?.categoryKey === 'all');
    expect(allCalls).toHaveLength(2);
    expect(appendMock).toHaveBeenCalledTimes(2);
  });

  it('warm-all with empty result retries on the next call', async () => {
    fetchMock.mockResolvedValue({ isError: false, images: [] } as never);

    await warmAllDeckIfNeeded({ language: 'fr', scope: { kind: 'public' }, authContext: {} });
    await warmAllDeckIfNeeded({ language: 'fr', scope: { kind: 'public' }, authContext: {} });

    const allCalls = fetchMock.mock.calls.filter((c) => c[0]?.categoryKey === 'all');
    expect(allCalls).toHaveLength(2);
    expect(appendMock).not.toHaveBeenCalled();
  });
});
