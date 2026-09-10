// SwipeImage behavior suite.
//
// Renders the REAL component subtree (SwipeImage → SwipeableCard →
// StarRatingBadge / GuessDescription, BadgeDetailModal, LoadingOverlay) and
// drives it through user-visible interactions: swipes fired through the
// rendered PanResponder handlers the way the native gesture layer would
// (boundary simulation), badge presses, and scripted server batches.
//
// Only system boundaries are mocked:
// - react-native-gesture-handler (native root view; a plain View passthrough)
// - AsyncStorage via __tests__/helpers/statefulAsyncStorageMock.ts (in-memory
//   stateful fake — decks, cursors, played sets, exhaustion markers, cycles
//   and the e2e card payload are seeded/asserted through the store map)
// - expo-file-system (native FS; card files "exist", deletes are recorded)
// - @react-native-vector-icons/ionicons (native font component)
// - axios (the network seam for badge-detail tags/ratings)
// - services/cardDeck's two SERVER-facing functions: fetchCardBatch IS the
//   server in this suite and probeAllPoolForUnplayed is the "all"-pool probe;
//   every storage-side deck writer (persistCardBatch / appendCardBatch /
//   removeCardFromGroupDeck) stays REAL so deck JSON in AsyncStorage is the
//   observable outcome
// - fake timers (jest modern fake timers + a 16ms requestAnimationFrame so
//   the swipe fling animations complete deterministically)
//
// Everything else (storageDatum, playedPictureIds, servingCycle, the
// prefetcher, groupFeedCache, e2eMode, i18n) runs REAL. Assertions target
// rendered output (testIDs, English copy from i18n/locales/en.json),
// AsyncStorage state, recorded file deletes, and the startGuessing callback.

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    GestureHandlerRootView: ({ children }) => React.createElement(View, null, children),
  };
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('./helpers/statefulAsyncStorageMock')({ autoReset: true }),
);

// Native file-system boundary. Deck files "exist" so seeded decks resolve;
// deletes are recorded so a dismissed card's cleanup is observable.
jest.mock('expo-file-system', () => {
  const deletedUris = [];

  class File {
    constructor(...args) {
      if (typeof args[0] === 'string') {
        this.uri = args[0];
      } else if (args.length > 1 && args[1] != null) {
        this.uri = `${String(args[0])}${String(args[1])}`;
      } else {
        this.uri = 'file:///cache/unknown';
      }
    }

    get exists() {
      return true;
    }

    delete() {
      deletedUris.push(this.uri);
    }

    create() {}
  }

  return {
    File,
    Paths: { cache: 'file:///cache/', document: 'file:///documents/' },
    __deletedUris: deletedUris,
  };
});

jest.mock('@react-native-vector-icons/ionicons', () => ({
  __esModule: true,
  default: () => null,
  Ionicons: () => null,
}));

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
    create: jest.fn(() => ({
      get: jest.fn(),
      post: jest.fn(),
      interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
    })),
  },
}));

// Server deck boundary: fetchCardBatch IS the server in this suite.
// appendCardBatch / persistCardBatch / removeCardFromGroupDeck stay REAL so
// scripted batches land in the observable AsyncStorage decks.
jest.mock('../services/cardDeck', () => {
  const actual = jest.requireActual('../services/cardDeck');
  return {
    ...actual,
    fetchCardBatch: jest.fn(),
    probeAllPoolForUnplayed: jest.fn(),
  };
});

import React from 'react';
import { Alert } from 'react-native';
import { act, create } from 'react-test-renderer';

import SwipeImage from '../components/UI/SwipeImage';
import { AuthContext } from '../store/auth-context';
import * as FileSystem from 'expo-file-system';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchCardBatch, probeAllPoolForUnplayed } from '../services/cardDeck';
import { __resetForTests } from '../services/cardPrefetcher';
import { PUBLIC_FEED_END_CURSOR } from '../utils/storageDatum';
import { PRIVATE_FEED_END_CURSOR } from '../services/groups/groupFeedApi';

const fetchCardBatchMock = fetchCardBatch;
const probeAllPoolForUnplayedMock = probeAllPoolForUnplayed;
const axiosGetMock = axios.get;

const store = require('@react-native-async-storage/async-storage').__store;

const contextValue = {
  token: 'token',
  uid: 'waldo@example.com',
  expiry: '123',
  access_token: 'access-token',
  client: 'client-id',
  userId: '42',
  scoreId: 'score-1',
};

// --- storage keys (shapes owned by storageDatum / playedPictureIds /
// servingCycle / groupFeedCache) ---------------------------------------------

const deckKey = (categoryKey = 'all', language = 'any') => `imageList:${categoryKey}:${language}`;
const publicCursorKey = (categoryKey = 'all', language = 'any') => `lastImageUuid:${categoryKey}:${language}`;
const exhaustedKey = (categoryKey, language = 'any') => `exhaustedCategory:${categoryKey}:${language}`;
const playedKey = (language = 'any') => `playedPictureIds:public:${language}`;
const groupPlayedKey = (groupId, language = 'any') => `playedPictureIds:group:${groupId}:${language}`;
const groupCycleKey = (groupId, language = 'any') => `servingCycle:group:${groupId}:${language}`;
const publicCycleKey = (language = 'any') => `servingCycle:public:${language}`;
const groupDeckKey = (groupId, categoryId = null, language = 'any') =>
  `groupFeed:${groupId}:${categoryId || 'all'}:${language}`;
// Private game cursors key off the category KEY (storageDatum
// lastImageUuidKeyForScope), not the server UUID.
const groupGameCursorKey = (groupId, categoryKey = 'all', language = 'any') =>
  `groupFeed:${groupId}:game:${categoryKey || 'all'}:${language}:cursor`;
const E2E_HIDDEN_GUESS_CARD_KEY = 'e2eHiddenGuessCard';

// --- storage helpers ---------------------------------------------------------

async function seedDeck(cards, categoryKey = 'all', language = 'any') {
  await AsyncStorage.setItem(deckKey(categoryKey, language), JSON.stringify(cards));
}

async function storedDeck(categoryKey = 'all', language = 'any') {
  const raw = await AsyncStorage.getItem(deckKey(categoryKey, language));
  return raw ? JSON.parse(raw) : [];
}

async function seedPlayedIds(pictureIds, language = 'any') {
  await AsyncStorage.setItem(playedKey(language), JSON.stringify(pictureIds));
}

function storeKeys() {
  return Array.from(store.keys());
}

// --- timing harness (mirrors GuessScreen.test.tsx) ---------------------------

let mockClockMs = 0;

function useFakeAnimationTimers() {
  jest.useFakeTimers();
  mockClockMs = 0;
  jest.spyOn(Date, 'now').mockImplementation(() => mockClockMs);
  jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) =>
    setTimeout(() => cb(jest.now()), 16),
  );
}

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 24; i++) {
      await Promise.resolve();
    }
  });
};

// Steps the clock in small increments so animations and latency-stalled
// fetches observe a Date.now() that matches the timer queue position.
const advance = async (ms) => {
  const step = 25;
  for (let elapsed = 0; elapsed < ms; elapsed += step) {
    mockClockMs += step;
    await act(async () => {
      jest.advanceTimersByTime(step);
      await Promise.resolve();
    });
  }
};

// Same teardown hazard as __tests__/GuessScreen.test.tsx: the fake→real
// timer switch costs variable real time per test (CPU-coupled), so the 5s
// default can flip on starved CI workers. 20s bounds it without slowing
// green runs.
jest.setTimeout(20000);

// --- rendering + gesture helpers ---------------------------------------------

async function renderSwipeImage({ category, language, scope } = {}) {
  const startGuessing = jest.fn();
  let renderer;

  await act(async () => {
    renderer = create(
      <AuthContext.Provider value={contextValue}>
        <SwipeImage
          screenWidth={320}
          screenHeight={640}
          startGuessing={startGuessing}
          category={category}
          language={language}
          scope={scope}
        />
      </AuthContext.Provider>,
    );
  });
  await flush();

  return { renderer, startGuessing };
}

function cardHandlers(renderer, listId) {
  return renderer.root.findByProps({ testID: `guess-path.card.${listId}` });
}

// Single-touch responder event whose touchHistory mirrors PanResponder's
// contract: previousPageX is the grab point, currentPageX the current finger
// position. The rendered panHandlers derive gestureState from it exactly as
// the native responder system would deliver it.
function panResponderEvent(dx) {
  const x0 = 160;
  return {
    nativeEvent: {},
    touchHistory: {
      numberActiveTouches: 1,
      indexOfSingleActiveTouch: 0,
      mostRecentTimeStamp: 20,
      touchBank: [
        {
          touchActive: true,
          startPageX: x0,
          startPageY: 300,
          startTimeStamp: 10,
          previousPageX: x0,
          previousPageY: 300,
          currentPageX: x0 + dx,
          currentPageY: 300,
          currentTimeStamp: 20,
        },
      ],
    },
  };
}

// Fires the card's rendered PanResponder handlers the way the native responder
// system would: a move past the tap-slop claims the gesture and accumulates
// the drag distance, the release settles it. The fling animation then
// completes on the fake timer queue before the onSwipe/removeCard callback
// fires.
async function swipeCard(renderer, listId, dx) {
  const handlers = cardHandlers(renderer, listId).props;

  await act(async () => {
    handlers.onResponderMove?.(panResponderEvent(dx));
    handlers.onResponderRelease?.(panResponderEvent(dx));
  });
  await advance(600);
  await flush();
}

const swipeLeft = (renderer, listId) => swipeCard(renderer, listId, -320);
const swipeRight = (renderer, listId) => swipeCard(renderer, listId, 320);

function isHostCardNode(node) {
  return typeof node.type === 'string' && typeof node.props?.testID === 'string';
}

// RN components render as a composite wrapper + host node pair that BOTH carry
// the forwarded props; count host nodes only so a rendered element counts once.
function hostNodesWithProps(renderer, props) {
  return renderer.root.findAllByProps(props).filter((node) => typeof node.type === 'string');
}

function renderedCardTestIds(renderer) {
  return renderer.root
    .findAll((node) => isHostCardNode(node) && /^guess-path\.card\.\d+$/.test(node.props.testID))
    .map((node) => node.props.testID);
}

function renderedCardImageUris(renderer) {
  return renderer.root
    .findAll((node) => isHostCardNode(node) && node.props.testID.startsWith('guess-path.card-image.'))
    .map((node) => node.props.source?.uri);
}

function renderedText(renderer) {
  return renderer.root
    .findAll((node) => node.type === 'Text' && node.props?.children !== undefined)
    .map((node) => node.props.children)
    .flat()
    .join(' ');
}

// --- server scripting --------------------------------------------------------

const EMPTY_BATCH = { isError: false, reason: 'empty', images: [] };

function serverError(title, message) {
  return { isError: true, title, message };
}

function card(pictureId, imageFile) {
  return { pictureId, imageFile };
}

function fourCardDeck(prefix) {
  return [1, 2, 3, 4].map((n) => ({ listId: n, pictureId: `${prefix}-${n}`, imageFile: `file:///${prefix}-${n}.jpg` }));
}

// Default axios routes for the badge-detail reads; tests override per URL.
function defaultAxiosRoutes() {
  axiosGetMock.mockImplementation((url) => {
    if (String(url).endsWith('/image_tags')) {
      return Promise.resolve({ data: { data: [] } });
    }
    if (String(url).endsWith('/image_rating')) {
      return Promise.resolve({ data: { data: undefined } });
    }
    return Promise.resolve({ data: {} });
  });
}

function setE2EMode(enabled) {
  if (enabled) {
    process.env.EXPO_PUBLIC_E2E_MODE = 'true';
  } else {
    delete process.env.EXPO_PUBLIC_E2E_MODE;
  }
}

describe('SwipeImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetForTests();
    setE2EMode(false);
    fetchCardBatchMock.mockReset().mockResolvedValue(EMPTY_BATCH);
    probeAllPoolForUnplayedMock.mockReset().mockResolvedValue({ status: 'exhausted' });
    axiosGetMock.mockReset();
    defaultAxiosRoutes();
    axios.post.mockReset().mockResolvedValue({ data: {} });
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    useFakeAnimationTimers();
  });

  afterEach(async () => {
    await act(async () => {
      await Promise.resolve();
    });
    // Drop queued animation frames while fake timers are still installed so
    // no rAF/timer chain leaks into the next test on real timers.
    jest.clearAllTimers();
    jest.restoreAllMocks();
    jest.useRealTimers();
    setE2EMode(false);
  });

  describe('serving the deck', () => {
    it('serves a stored four-card deck without touching the network, newest card on top', async () => {
      await seedDeck(fourCardDeck('nat'));

      const { renderer } = await renderSwipeImage();

      expect(fetchCardBatchMock).not.toHaveBeenCalled();
      expect(renderedCardTestIds(renderer)).toEqual([
        'guess-path.card.4',
        'guess-path.card.3',
        'guess-path.card.2',
        'guess-path.card.1',
      ]);
    });

    it('a cold start fetches a batch, numbers the cards, and persists the deck', async () => {
      fetchCardBatchMock.mockResolvedValue({
        isError: false,
        images: [card('img-1', 'file:///one.jpg'), card('img-2', 'file:///two.jpg')],
      });

      const { renderer } = await renderSwipeImage();

      expect(await storedDeck()).toEqual([
        expect.objectContaining({ pictureId: 'img-1', listId: 1 }),
        expect.objectContaining({ pictureId: 'img-2', listId: 2 }),
      ]);
      expect(renderedCardImageUris(renderer)).toEqual(['file:///two.jpg', 'file:///one.jpg']);
    });

    it('already-played cards persist for resume but never serve', async () => {
      await seedPlayedIds(['batch-played']);
      fetchCardBatchMock.mockResolvedValue({
        isError: false,
        images: [card('batch-played', 'file:///played.jpg'), card('batch-fresh', 'file:///fresh.jpg')],
      });

      const { renderer } = await renderSwipeImage();

      expect(await storedDeck()).toEqual([
        expect.objectContaining({ pictureId: 'batch-played' }),
        expect.objectContaining({ pictureId: 'batch-fresh' }),
      ]);
      expect(renderedCardImageUris(renderer)).not.toContain('file:///played.jpg');
      expect(renderedCardImageUris(renderer)).toContain('file:///fresh.jpg');
    });

    it('a batch where every card was already played shows the exhausted panel, not a blank stack', async () => {
      await seedPlayedIds(['allp-1', 'allp-2']);
      probeAllPoolForUnplayedMock.mockResolvedValue({ status: 'indeterminate', reason: 'network' });
      fetchCardBatchMock.mockResolvedValue({
        isError: false,
        images: [card('allp-1', 'file:///ap1.jpg'), card('allp-2', 'file:///ap2.jpg')],
      });

      const { renderer } = await renderSwipeImage();

      expect(renderedCardImageUris(renderer)).toEqual([]);
      expect(renderedText(renderer)).toContain('No more images to guess right now!');
      expect(store.get(publicCycleKey())).toBeUndefined();
    });

    it('a dry feed shows the play guidance instead of cards', async () => {
      const { renderer } = await renderSwipeImage();

      const text = renderedText(renderer);
      expect(text).toContain('No more images to guess right now!');
      expect(text).toContain('To play you can:');
      expect(text).toContain('Upload new images');
    });

    it('a failed feed load alerts the player and shows the error panel without retrying', async () => {
      fetchCardBatchMock.mockResolvedValue(serverError('Server error', 'Please retry later'));

      const { renderer } = await renderSwipeImage();

      expect(Alert.alert).toHaveBeenCalledWith('Server error', 'Please retry later');
      expect(renderedText(renderer)).toContain('The list is not there');
      expect(fetchCardBatchMock).toHaveBeenCalledTimes(1);
    });

    it('a fully-played stored deck fetches fresh cards instead of rendering a blank stack', async () => {
      await seedDeck(fourCardDeck('old'));
      await seedPlayedIds(['old-1', 'old-2', 'old-3', 'old-4']);
      fetchCardBatchMock.mockResolvedValueOnce({
        isError: false,
        images: [card('fresh-1', 'file:///f1.jpg')],
      });

      const { renderer } = await renderSwipeImage();

      expect(renderedCardImageUris(renderer)).toContain('file:///f1.jpg');
      expect(await storedDeck()).toEqual([
        expect.objectContaining({ pictureId: 'fresh-1', listId: 1 }),
      ]);
    });

    it('a partially-played stored deck serves only the unplayed remainder without fetching', async () => {
      await seedDeck(fourCardDeck('mix'));
      await seedPlayedIds(['mix-1', 'mix-2']);

      const { renderer } = await renderSwipeImage();

      expect(fetchCardBatchMock).not.toHaveBeenCalled();
      expect(renderedCardImageUris(renderer)).toEqual(['file:///mix-4.jpg', 'file:///mix-3.jpg']);
    });
  });

  describe('swiping cards', () => {
    it('a rightward swipe starts the guess with the swiped card and keeps the deck', async () => {
      await seedDeck(fourCardDeck('nat'));

      const { renderer, startGuessing } = await renderSwipeImage();

      await swipeRight(renderer, 1);

      expect(startGuessing).toHaveBeenCalledTimes(1);
      expect(startGuessing).toHaveBeenCalledWith({ item: expect.objectContaining({ listId: 1, pictureId: 'nat-1' }) });
      expect(await storedDeck()).toHaveLength(4);
    });

    it('a leftward swipe dismisses the card from the deck', async () => {
      await seedDeck(fourCardDeck('nat'));

      const { renderer } = await renderSwipeImage();

      await swipeLeft(renderer, 1);

      const deck = await storedDeck();
      expect(deck.map((c) => c.listId)).toEqual([2, 3, 4]);
      expect(renderedCardImageUris(renderer)).not.toContain('file:///nat-1.jpg');
    });

    it('a dismissed card is banked as played so it cannot re-serve', async () => {
      await seedDeck(fourCardDeck('nat'));

      const { renderer } = await renderSwipeImage();

      await swipeLeft(renderer, 1);

      expect(JSON.parse(await AsyncStorage.getItem(playedKey()))).toContain('nat-1');
    });

    it('a dismissed card deletes its local image file', async () => {
      await seedDeck(fourCardDeck('nat'));

      const { renderer } = await renderSwipeImage();

      await swipeLeft(renderer, 1);

      expect(FileSystem.__deletedUris).toContain('file:///nat-1.jpg');
    });

    it('a card swiped before a lagging server batch lands stays dismissed', async () => {
      await seedDeck(fourCardDeck('nat'));
      fetchCardBatchMock.mockResolvedValue({
        isError: false,
        images: [card('nat-1', 'file:///nat-1.jpg'), card('topup-9', 'file:///topup-9.jpg')],
      });

      const { renderer } = await renderSwipeImage();

      await swipeLeft(renderer, 1);

      const deckPictureIds = (await storedDeck()).map((c) => c.pictureId);
      expect(deckPictureIds).toContain('topup-9');
      expect(deckPictureIds).not.toContain('nat-1');
      expect(renderedCardImageUris(renderer)).not.toContain('file:///nat-1.jpg');
    });
  });

  describe('background top-ups after dismissals', () => {
    it('running low after a dismissal tops up the active category in the background', async () => {
      await seedDeck(fourCardDeck('nat'), 'nature');
      fetchCardBatchMock.mockResolvedValue({
        isError: false,
        images: [card('topup-5', 'file:///topup-5.jpg')],
      });

      const { renderer } = await renderSwipeImage({
        category: { id: 'cat-nature', key: 'nature' },
      });

      await swipeLeft(renderer, 1);

      expect(fetchCardBatchMock).toHaveBeenCalledWith(
        expect.objectContaining({ categoryKey: 'nature', categoryId: 'cat-nature' }),
      );
      const deck = await storedDeck('nature');
      expect(deck.map((c) => c.pictureId)).toContain('topup-5');
      expect(deck).toHaveLength(4);
    });

    it('a dry category top-up marks the category exhausted and stops asking the server', async () => {
      await seedDeck(fourCardDeck('nat'), 'nature');

      const { renderer } = await renderSwipeImage({
        category: { id: 'cat-nature', key: 'nature' },
      });

      await swipeLeft(renderer, 1);
      await swipeLeft(renderer, 2);

      const natureFetches = fetchCardBatchMock.mock.calls.filter(
        (call) => call[0]?.categoryKey === 'nature',
      );
      expect(natureFetches).toHaveLength(1);
      expect(await AsyncStorage.getItem(exhaustedKey('nature'))).toBe('1');
      expect(renderedCardImageUris(renderer)).toEqual(['file:///nat-4.jpg', 'file:///nat-3.jpg']);
    });

    it('a failing background top-up never alerts the player', async () => {
      await seedDeck(fourCardDeck('nat'), 'nature');
      fetchCardBatchMock.mockRejectedValueOnce(new Error('prefetcher failed'));

      const { renderer } = await renderSwipeImage({
        category: { id: 'cat-nature', key: 'nature' },
      });

      await swipeLeft(renderer, 1);

      expect(Alert.alert).not.toHaveBeenCalled();
      expect(renderedCardImageUris(renderer)).toEqual(['file:///nat-4.jpg', 'file:///nat-3.jpg', 'file:///nat-2.jpg']);
      expect(renderedText(renderer)).not.toContain('The list is not there');
    });

    it('a private-scope dismissal removes the card from the group deck and top-ups the group category', async () => {
      const scope = { kind: 'private', groupId: 'group-7' };
      await AsyncStorage.setItem(
        groupDeckKey('group-7', 'cat-nature', 'fr'),
        JSON.stringify(fourCardDeck('grp')),
      );
      fetchCardBatchMock.mockResolvedValue({
        isError: false,
        images: [card('grp-topup', 'file:///grp-topup.jpg')],
      });

      const { renderer } = await renderSwipeImage({
        category: { id: 'cat-nature', key: 'nature' },
        language: 'fr',
        scope,
      });

      await swipeLeft(renderer, 1);

      const groupDeck = JSON.parse(await AsyncStorage.getItem(groupDeckKey('group-7', 'cat-nature', 'fr')));
      expect(groupDeck.map((c) => c.pictureId)).not.toContain('grp-1');
      expect(groupDeck.map((c) => c.pictureId)).toContain('grp-topup');
      expect(groupDeck).toHaveLength(4);
      expect(fetchCardBatchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          categoryKey: 'nature',
          categoryId: 'cat-nature',
          language: 'fr',
          scope,
        }),
      );
      expect(storeKeys().some((key) => key.startsWith('imageList:'))).toBe(false);
      expect(renderedCardImageUris(renderer)).not.toContain('file:///grp-1.jpg');
    });
  });

  describe('deck-empty refills', () => {
    it('emptying a category deck serves the stored "all" deck; further dismissal writes the "all" namespace', async () => {
      const natureCards = fourCardDeck('nat');
      await seedDeck(natureCards, 'nature');
      await seedDeck([{ listId: 9, pictureId: 'all-1', imageFile: 'file:///all-1.jpg' }], 'all');

      const { renderer } = await renderSwipeImage({
        category: { id: 'cat-nature', key: 'nature' },
      });

      for (const listId of [1, 2, 3, 4]) {
        await swipeLeft(renderer, listId);
      }

      expect(renderedCardImageUris(renderer)).toContain('file:///all-1.jpg');

      await swipeLeft(renderer, 9);

      expect(await storedDeck('all')).toEqual([]);
    });

    it('background top-ups keep a dismissed-down deck serving without an exhaustion marker', async () => {
      await seedDeck(fourCardDeck('nat'));
      let topup = 0;
      fetchCardBatchMock.mockImplementation(() => {
        topup += 1;
        return Promise.resolve({ isError: false, images: [card(`topup-${topup}`, `file:///t${topup}.jpg`)] });
      });

      const { renderer } = await renderSwipeImage();

      for (const listId of [1, 2, 3, 4]) {
        await swipeLeft(renderer, listId);
      }

      expect(renderedCardImageUris(renderer)).toContain('file:///t1.jpg');
      expect(storeKeys().some((key) => key.startsWith('exhaustedCategory:'))).toBe(false);
      expect(renderedText(renderer)).not.toContain('No more images to guess right now!');
    });

    it('a dry server with both decks empty ends on the exhausted panel', async () => {
      await seedDeck(fourCardDeck('nat'), 'nature');

      const { renderer } = await renderSwipeImage({
        category: { id: 'cat-nature', key: 'nature' },
      });

      for (const listId of [1, 2, 3, 4]) {
        await swipeLeft(renderer, listId);
      }

      expect(renderedText(renderer)).toContain('No more images to guess right now!');
      expect(renderedText(renderer)).not.toContain('Loading new images...');
    });

    it('a fresh upload revives an exhausted category on the next visit', async () => {
      await AsyncStorage.setItem(exhaustedKey('nature'), '1');
      fetchCardBatchMock.mockResolvedValue({
        isError: false,
        images: [card('fresh-1', 'file:///f1.jpg')],
      });

      const { renderer } = await renderSwipeImage({
        category: { id: 'cat-nature', key: 'nature' },
      });

      expect(renderedCardImageUris(renderer)).toContain('file:///f1.jpg');
      expect(await AsyncStorage.getItem(exhaustedKey('nature'))).toBeNull();
    });

    it('a drained "all" deck foreground-loads and never writes an exhaustion marker', async () => {
      await seedDeck(fourCardDeck('nat'));

      const { renderer } = await renderSwipeImage();

      for (const listId of [1, 2, 3, 4]) {
        await swipeLeft(renderer, listId);
      }

      expect(storeKeys().some((key) => key.startsWith('exhaustedCategory:'))).toBe(false);
      expect(renderedText(renderer)).toContain('No more images to guess right now!');
    });
  });

  describe('feed resumption', () => {
    it('a stored cursor resumes the feed where it stopped', async () => {
      await AsyncStorage.setItem(publicCursorKey('nature'), 'stored-cursor-9');
      fetchCardBatchMock.mockResolvedValue({
        isError: false,
        images: [card('resume-1', 'file:///r1.jpg')],
      });

      const { renderer } = await renderSwipeImage({
        category: { id: 'cat-nature', key: 'nature' },
      });

      expect(fetchCardBatchMock).toHaveBeenCalledTimes(1);
      expect(await storedDeck('nature')).toEqual([
        expect.objectContaining({ pictureId: 'resume-1', listId: 1 }),
      ]);
      expect(renderedCardImageUris(renderer)).toContain('file:///r1.jpg');
      expect(store.get(publicCycleKey())).toBeUndefined();
    });

    it('an exhausted cursor round falls back to a fresh head query and keeps the stored cursor', async () => {
      await AsyncStorage.setItem(publicCursorKey('nature'), 'stored-cursor-9');
      fetchCardBatchMock
        .mockResolvedValueOnce(EMPTY_BATCH)
        .mockResolvedValueOnce({ isError: false, images: [card('head-fresh', 'file:///hf.jpg')] });

      const { renderer } = await renderSwipeImage({
        category: { id: 'cat-nature', key: 'nature' },
      });

      expect(fetchCardBatchMock).toHaveBeenCalledTimes(2);
      expect(fetchCardBatchMock.mock.calls[1][0]).toEqual(
        expect.objectContaining({ pictureIdOverride: null }),
      );
      expect(await AsyncStorage.getItem(publicCursorKey('nature'))).toBe('stored-cursor-9');
      expect(renderedCardImageUris(renderer)).toContain('file:///hf.jpg');
    });

    it('a double-empty round parks the public feed-end cursor', async () => {
      fetchCardBatchMock.mockResolvedValue(EMPTY_BATCH);

      const { renderer } = await renderSwipeImage({
        category: { id: 'cat-nature', key: 'nature' },
      });

      expect(fetchCardBatchMock).toHaveBeenCalledTimes(2);
      expect(await AsyncStorage.getItem(publicCursorKey('nature'))).toBe(PUBLIC_FEED_END_CURSOR);
      expect(renderedText(renderer)).toContain('No more images to guess right now!');
      expect(store.get(publicCycleKey())).toBeUndefined();
    });

    it('a partial deck tops up from the cursor, then head-probes when the cursor round is dry', async () => {
      await seedDeck(
        [
          { listId: 1, pictureId: 'part-1', imageFile: 'file:///p1.jpg' },
          { listId: 2, pictureId: 'part-2', imageFile: 'file:///p2.jpg' },
        ],
        'nature',
      );
      await AsyncStorage.setItem(publicCursorKey('nature'), 'stored-cursor-9');
      // Latency-stalled server rounds: the served partial deck commits to the
      // screen while both rounds are in flight, the way a real feed does.
      let round = 0;
      fetchCardBatchMock.mockImplementation(() => {
        round += 1;
        const response = round === 1
          ? EMPTY_BATCH
          : { isError: false, images: [card('head-fresh', 'file:///hf.jpg')] };
        return new Promise((resolve) => setTimeout(() => resolve(response), 50));
      });

      const { renderer } = await renderSwipeImage({
        category: { id: 'cat-nature', key: 'nature' },
      });

      await advance(50);
      await advance(100);
      await flush();

      expect(fetchCardBatchMock).toHaveBeenCalledTimes(2);
      expect(fetchCardBatchMock.mock.calls[1][0]).toEqual(
        expect.objectContaining({ pictureIdOverride: null }),
      );
      const deck = await storedDeck('nature');
      expect(deck).toHaveLength(3);
      expect(deck.map((c) => c.pictureId)).toEqual(['part-1', 'part-2', 'head-fresh']);
      expect(await AsyncStorage.getItem(publicCursorKey('nature'))).toBe('stored-cursor-9');
      expect(renderedCardImageUris(renderer)).toContain('file:///hf.jpg');
    });

    it('a private scope parks the group-scoped feed-end cursor', async () => {
      const scope = { kind: 'private', groupId: 'group-7' };
      await AsyncStorage.setItem(
        groupDeckKey('group-7', 'cat-nature', 'fr'),
        JSON.stringify([
          { listId: 1, pictureId: 'part-1', imageFile: 'file:///p1.jpg' },
          { listId: 2, pictureId: 'part-2', imageFile: 'file:///p2.jpg' },
        ]),
      );
      await AsyncStorage.setItem(groupGameCursorKey('group-7', 'nature', 'fr'), 'stored-cursor-9');
      fetchCardBatchMock.mockResolvedValue(EMPTY_BATCH);

      await renderSwipeImage({
        category: { id: 'cat-nature', key: 'nature' },
        language: 'fr',
        scope,
      });

      expect(fetchCardBatchMock).toHaveBeenCalledTimes(2);
      expect(await AsyncStorage.getItem(groupGameCursorKey('group-7', 'nature', 'fr'))).toBe(
        PRIVATE_FEED_END_CURSOR,
      );
      expect(await AsyncStorage.getItem(publicCursorKey('nature', 'fr'))).toBeNull();
    });
  });

  describe('cycle recovery', () => {
    it('a fully-played deck over a drained all-pool restarts the serving cycle exactly once', async () => {
      await seedDeck(fourCardDeck('cyc'), 'nature');
      await seedPlayedIds(['cyc-1', 'cyc-2', 'cyc-3', 'cyc-4']);
      fetchCardBatchMock
        .mockResolvedValueOnce(EMPTY_BATCH)
        .mockResolvedValueOnce({
          isError: false,
          images: [card('cyc-1', 'file:///c1.jpg'), card('cyc-2', 'file:///c2.jpg')],
        });

      const { renderer } = await renderSwipeImage({
        category: { id: 'cat-nature', key: 'nature' },
      });

      expect(store.get(publicCycleKey())).toBe('1');
      expect(await AsyncStorage.getItem(playedKey())).toBeNull();
      const served = renderedCardImageUris(renderer);
      expect(served).toContain('file:///c1.jpg');
      expect(served).toContain('file:///c2.jpg');
    });

    it('a failed head probe gates the cycle restart off and keeps the played set', async () => {
      await seedDeck(fourCardDeck('cyc'), 'nature');
      await seedPlayedIds(['cyc-1', 'cyc-2', 'cyc-3', 'cyc-4']);
      fetchCardBatchMock
        .mockResolvedValueOnce(EMPTY_BATCH)
        .mockResolvedValueOnce(serverError('Server error', 'Please retry later'));

      const { renderer } = await renderSwipeImage({
        category: { id: 'cat-nature', key: 'nature' },
      });

      expect(Alert.alert).toHaveBeenCalledWith('Server error', 'Please retry later');
      expect(store.get(publicCycleKey())).toBeUndefined();
      expect(JSON.parse(await AsyncStorage.getItem(playedKey()))).toContain('cyc-1');
      expect(renderedText(renderer)).toContain('The list is not there');
    });

    it('an unplayed all-pool probe serves the "all" deck and switches the removal namespace without a cycle restart', async () => {
      await seedPlayedIds(['bug2-1', 'bug2-2']);
      probeAllPoolForUnplayedMock.mockResolvedValue({ status: 'unplayed' });
      await seedDeck(
        [
          { listId: 1, pictureId: 'all-fresh-1', imageFile: 'file:///af1.jpg' },
          { listId: 2, pictureId: 'all-fresh-2', imageFile: 'file:///af2.jpg' },
        ],
        'all',
      );
      fetchCardBatchMock
        .mockResolvedValueOnce(EMPTY_BATCH)
        .mockResolvedValueOnce({
          isError: false,
          images: [card('bug2-1', 'file:///b1.jpg'), card('bug2-2', 'file:///b2.jpg')],
        });

      const { renderer } = await renderSwipeImage({
        category: { id: 'cat-nature', key: 'nature' },
      });

      const served = renderedCardImageUris(renderer);
      expect(served).toContain('file:///af1.jpg');
      expect(served).toContain('file:///af2.jpg');
      expect(store.get(publicCycleKey())).toBeUndefined();

      await swipeLeft(renderer, 2);

      const allDeck = await storedDeck('all');
      expect(allDeck.map((c) => c.pictureId)).toEqual(['all-fresh-1']);
    });

    it('an indeterminate all-pool probe stands down on the exhausted flow', async () => {
      await seedPlayedIds(['indet-1', 'indet-2']);
      probeAllPoolForUnplayedMock.mockResolvedValue({ status: 'indeterminate', reason: 'network' });
      fetchCardBatchMock
        .mockResolvedValueOnce(EMPTY_BATCH)
        .mockResolvedValueOnce({
          isError: false,
          images: [card('indet-1', 'file:///i1.jpg'), card('indet-2', 'file:///i2.jpg')],
        });

      const { renderer } = await renderSwipeImage({
        category: { id: 'cat-nature', key: 'nature' },
      });

      expect(store.get(publicCycleKey())).toBeUndefined();
      expect(renderedText(renderer)).toContain('No more images to guess right now!');
      expect(renderedCardImageUris(renderer)).toEqual([]);
    });

    it('a proven-drained pool restarts the cycle even against stale sentinels and markers', async () => {
      await seedPlayedIds(['comp-1', 'comp-2']);
      await AsyncStorage.setItem(publicCursorKey('nature'), PUBLIC_FEED_END_CURSOR);
      await AsyncStorage.setItem(exhaustedKey('nature'), '1');
      fetchCardBatchMock
        .mockResolvedValueOnce(EMPTY_BATCH)
        .mockResolvedValueOnce({
          isError: false,
          images: [card('comp-1', 'file:///c1.jpg'), card('comp-2', 'file:///c2.jpg')],
        });

      const { renderer } = await renderSwipeImage({
        category: { id: 'cat-nature', key: 'nature' },
      });

      expect(store.get(publicCycleKey())).toBe('1');
      expect(await AsyncStorage.getItem(playedKey())).toBeNull();
      expect(await AsyncStorage.getItem(publicCursorKey('nature'))).toBeNull();
      expect(await AsyncStorage.getItem(exhaustedKey('nature'))).toBeNull();
      const served = renderedCardImageUris(renderer);
      expect(served).toContain('file:///c1.jpg');
      expect(served).toContain('file:///c2.jpg');
    });

    it('private cycle recovery scopes the transition to the group', async () => {
      const scope = { kind: 'private', groupId: 'group-7' };
      await AsyncStorage.setItem(
        groupDeckKey('group-7', 'cat-nature', 'fr'),
        JSON.stringify([]),
      );
      await AsyncStorage.setItem(groupPlayedKey('group-7', 'fr'), JSON.stringify(['priv-1', 'priv-2']));
      fetchCardBatchMock
        .mockResolvedValueOnce(EMPTY_BATCH)
        .mockResolvedValueOnce({
          isError: false,
          images: [card('priv-1', 'file:///p1.jpg'), card('priv-2', 'file:///p2.jpg')],
        });

      const { renderer } = await renderSwipeImage({
        category: { id: 'cat-nature', key: 'nature' },
        language: 'fr',
        scope,
      });

      expect(store.get(groupCycleKey('group-7', 'fr'))).toBe('1');
      expect(await AsyncStorage.getItem(groupPlayedKey('group-7', 'fr'))).toBeNull();
      expect(storeKeys().some((key) => key.startsWith('imageList:'))).toBe(false);
      expect(storeKeys().some((key) => key.startsWith('servingCycle:public'))).toBe(false);
      const served = renderedCardImageUris(renderer);
      expect(served).toContain('file:///p1.jpg');
      expect(served).toContain('file:///p2.jpg');
    });
  });

  describe('badge detail', () => {
    async function seedRichDeck() {
      await seedDeck([
        {
          listId: 1,
          pictureId: 'img-1',
          imageFile: 'file:///1.jpg',
          averageRating: 4.5,
          ratingsCount: 9,
          category: { name: 'City' },
          language: 'fr',
          creatorUsername: 'waldo',
          createdAt: '2026-01-02T00:00:00Z',
          fullDescription: 'Find Waldo near the bridge.',
        },
        { listId: 2, pictureId: 'img-2', imageFile: 'file:///2.jpg' },
        { listId: 3, pictureId: 'img-3', imageFile: 'file:///3.jpg' },
        { listId: 4, pictureId: 'img-4', imageFile: 'file:///4.jpg' },
      ]);
    }

    it('pressing a card badge opens one detail modal populated from the card and its fetched details', async () => {
      await seedRichDeck();
      axiosGetMock.mockImplementation((url) => {
        if (String(url).endsWith('/image_tags')) {
          return Promise.resolve({ data: { data: [{ id: 'tag-1', name: 'scenic' }, { id: 'tag-2', name: 'night' }] } });
        }
        if (String(url).endsWith('/image_rating')) {
          return Promise.resolve({
            data: { data: { global_rating: 4, quality_rating: 3, enigma_rating: 4, fun_rating: 5, difficulty_rating: 2 } },
          });
        }
        return Promise.resolve({ data: {} });
      });

      const { renderer } = await renderSwipeImage();

      await act(async () => {
        renderer.root.findByProps({ testID: 'guess-path.card.1.badge' }).props.onPress();
      });
      await flush();

      expect(hostNodesWithProps(renderer, { testID: 'guess-path.detail.modal' })).toHaveLength(1);
      const tagsRow = renderer.root.findByProps({ testID: 'guess-path.detail.row.tags' });
      expect(tagsRow.findAllByType('Text').map((node) => String(node.props.children)).join(' ')).toContain('scenic, night');
      const globalRow = renderer.root.findByProps({ testID: 'guess-path.detail.row.global-rating' });
      const globalText = globalRow.findAllByType('Text').map((node) => String(node.props.children)).join(' ');
      expect(globalText).toContain('4.5');
      expect(globalText).toContain('9');
      expect(renderer.root.findByProps({ testID: 'guess-path.detail.row.detailed-ratings' })).toBeTruthy();

      await act(async () => {
        renderer.root.findByProps({ testID: 'guess-path.detail.close' }).props.onPress();
      });
      await flush();

      expect(hostNodesWithProps(renderer, { testID: 'guess-path.detail.modal' })).toHaveLength(0);
    });

    it('the modal fills in progressively as the tag and rating fetches settle', async () => {
      await seedRichDeck();
      let resolveTags = () => {};
      let resolveRating = () => {};
      axiosGetMock.mockImplementation((url) => {
        if (String(url).endsWith('/image_tags')) {
          return new Promise((resolve) => {
            resolveTags = resolve;
          });
        }
        if (String(url).endsWith('/image_rating')) {
          return new Promise((resolve) => {
            resolveRating = resolve;
          });
        }
        return Promise.resolve({ data: {} });
      });

      const { renderer } = await renderSwipeImage();

      await act(async () => {
        renderer.root.findByProps({ testID: 'guess-path.card.1.badge' }).props.onPress();
      });
      await flush();

      expect(renderer.root.findAllByProps({ testID: 'guess-path.detail.row.tags' })).toHaveLength(0);

      await act(async () => {
        resolveTags({ data: { data: [{ id: 'tag-1', name: 'scenic' }] } });
        await Promise.resolve();
      });
      await flush();

      const tagsRow = renderer.root.findByProps({ testID: 'guess-path.detail.row.tags' });
      expect(
        tagsRow.findAllByType('Text').map((node) => String(node.props.children)).join(' '),
      ).toContain('scenic');
      expect(renderer.root.findAllByProps({ testID: 'guess-path.detail.row.detailed-ratings' })).toHaveLength(0);

      await act(async () => {
        resolveRating({ data: { data: { global_rating: 4, quality_rating: 3, enigma_rating: 4, fun_rating: 5, difficulty_rating: 2 } } });
        await Promise.resolve();
      });
      await flush();

      expect(renderer.root.findByProps({ testID: 'guess-path.detail.row.detailed-ratings' })).toBeTruthy();
      expect(renderer.root.findByProps({ testID: 'guess-path.detail.row.detailed-ratings.quality' })).toBeTruthy();
    });

    it('closing the modal before the detail fetches settle stays silent', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      await seedRichDeck();
      let resolveTags = () => {};
      axiosGetMock.mockImplementation((url) => {
        if (String(url).endsWith('/image_tags')) {
          return new Promise((resolve) => {
            resolveTags = resolve;
          });
        }
        return Promise.resolve({ data: { data: undefined } });
      });

      const { renderer } = await renderSwipeImage();

      await act(async () => {
        renderer.root.findByProps({ testID: 'guess-path.card.1.badge' }).props.onPress();
      });
      await flush();

      await act(async () => {
        renderer.root.findByProps({ testID: 'guess-path.detail.close' }).props.onPress();
      });
      await flush();
      await act(async () => {
        renderer.unmount();
      });

      await act(async () => {
        resolveTags({ data: { data: [{ id: 'tag-1', name: 'scenic' }] } });
        await Promise.resolve();
      });
      await flush();

      expect(consoleErrorSpy).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('e2e mode', () => {
    it('serves the seeded fallback card with no storage-deck or network reads, and swipes play', async () => {
      setE2EMode(true);

      const { renderer, startGuessing } = await renderSwipeImage();

      expect(renderer.root.findAllByProps({ testID: 'guess-path.card.fallback' }).filter((node) => typeof node.type === 'string')).toHaveLength(1);
      expect(fetchCardBatchMock).not.toHaveBeenCalled();
      expect(storeKeys().some((key) => key.startsWith('imageList:'))).toBe(false);

      await swipeRight(renderer, 1);

      expect(startGuessing).toHaveBeenCalledWith({ item: expect.objectContaining({ pictureId: 'e2e-guess-card' }) });
      expect(fetchCardBatchMock).not.toHaveBeenCalled();
    });

    it('prefers a saved hidden guess card over the seeded fallback', async () => {
      setE2EMode(true);
      await AsyncStorage.setItem(
        E2E_HIDDEN_GUESS_CARD_KEY,
        JSON.stringify({ uri: 'file:///saved-hide.jpg', pictureId: 'e2e-hidden-guess-card' }),
      );

      const { renderer } = await renderSwipeImage();

      expect(hostNodesWithProps(renderer, { testID: 'guess-path.card.saved' })).toHaveLength(1);
      expect(hostNodesWithProps(renderer, { testID: 'guess-path.card.fallback' })).toHaveLength(0);
      expect(renderedCardImageUris(renderer)).toContain('file:///saved-hide.jpg');
    });
  });
});
