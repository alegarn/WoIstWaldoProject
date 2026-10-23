jest.mock('react-native', () => ({
  Image: {
    resolveAssetSource: jest.fn(() => ({
      uri: 'file:///e2e-fixture.jpg',
      width: 320,
      height: 240,
    })),
  },
}));

jest.mock('../utils/storageDatum', () => ({
  savePreferredLanguage: jest.fn(() => Promise.resolve(null)),
  setOnboardingCompleted: jest.fn(() => Promise.resolve(null)),
}));

import {
  E2E_SHAPE_GUESS_HIT,
  E2E_SHAPE_GUESS_MISS,
  E2E_SHAPE_POLYGON,
  buildE2ECategories,
  buildE2EGuessCardFromPayload,
  buildE2EGuessCards,
  buildE2EHiddenGuessPayload,
  buildE2EHideRouteParams,
  buildE2EImageDetail,
  buildE2EImageRating,
  buildE2EImageTags,
  buildE2EPictureSelection,
  buildE2ERankingResponse,
  buildE2ERankingRows,
  buildE2EUserScores,
  getE2EAdDelayMs,
  getE2EIncorrectHideLocation,
  getE2EShapeOutline,
  isE2EMode,
} from '../utils/e2eMode';
import { isWinningTrace } from '../utils/shapeMatch';

describe('e2eMode helpers', () => {
  const originalE2EMode = process.env.EXPO_PUBLIC_E2E_MODE;

  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_E2E_MODE;
  });

  afterAll(() => {
    process.env.EXPO_PUBLIC_E2E_MODE = originalE2EMode;
  });

  it('builds hide route params from the bundled fixture asset', () => {
    expect(buildE2EHideRouteParams({ screenWidth: 320, screenHeight: 640, isTutorial: false })).toEqual({
      uri: 'file:///e2e-fixture.jpg',
      imageWidth: 320,
      imageHeight: 240,
      screenHeight: 640,
      screenWidth: 320,
      isPortrait: false,
      isTutorial: false,
    });
  });

  it('builds a deterministic target selection from normalized coordinates', () => {
    expect(
      buildE2EPictureSelection({
        screenWidth: 320,
        screenHeight: 640,
        imageDimensionStyle: { width: 200, height: 100 },
        relativeLocation: { x: 0.5, y: 0.5 },
      })
    ).toEqual({
      location: { x: '0.50', y: '0.50' },
      target: {
        targetSize: 16,
        targetStyle: {
          position: 'absolute',
          width: 16,
          height: 16,
          left: 92,
          top: 42,
        },
        dragSize: 32,
        dragStyle: {
          position: 'absolute',
          width: 32,
          height: 32,
          left: 84,
          top: 34,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
        },
      },
    });
  });

  it('returns a seeded guess card for deterministic swipe flows', () => {
    expect(buildE2EGuessCards()).toEqual([
      expect.objectContaining({
        imageFile: 'file:///e2e-fixture.jpg',
        pictureId: 'e2e-guess-card',
        listId: 1,
        category: expect.objectContaining({ id: 'e2e-cat-nature', key: 'nature', name: 'Nature' }),
        language: 'en',
        averageRating: expect.any(Number),
        ratingsCount: expect.any(Number),
        tags: expect.any(Array),
        creatorUsername: expect.any(String),
        createdAt: expect.any(String),
        fullDescription: expect.any(String),
      }),
    ]);
  });

  it('exposes a deterministic set of e2e categories for browse flows', () => {
    const categories = buildE2ECategories();

    expect(categories).toHaveLength(9);
    expect(categories[0].id).toBe('e2e-default-category');

    categories.forEach((category) => {
      expect(category).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          key: expect.any(String),
          name: expect.any(String),
          thumbnailUrl: expect.anything(),
        }),
      );
      expect('count' in category).toBe(true);
    });
  });

  it('builds and restores an e2e hidden guess payload for the saved hide bridge', () => {
    const payload = buildE2EHiddenGuessPayload({
      uri: 'file:///saved-hide.jpg',
      description: 'Look near the barn',
      imageHeight: 240,
      imageWidth: 320,
      isPortrait: false,
      hiddenLocation: { x: 0.58, y: 0.46 },
      screenHeight: 640,
      screenWidth: 320,
    });

    expect(payload).toEqual({
      uri: 'file:///saved-hide.jpg',
      pictureId: 'e2e-hidden-guess-card',
      description: 'Look near the barn',
      imageHeight: 240,
      imageWidth: 320,
      isPortrait: false,
      hiddenLocation: { x: 0.58, y: 0.46 },
      screenHeight: 640,
      screenWidth: 320,
    });

    expect(buildE2EGuessCardFromPayload(payload)).toEqual(
      expect.objectContaining({
        imageFile: 'file:///saved-hide.jpg',
        pictureId: 'e2e-hidden-guess-card',
        description: 'Look near the barn',
        touchLocation: { x: 0.58, y: 0.46 },
        listId: 1,
        language: 'en',
        averageRating: expect.any(Number),
        ratingsCount: expect.any(Number),
        tags: expect.any(Array),
        creatorUsername: expect.any(String),
        createdAt: expect.any(String),
        fullDescription: expect.any(String),
      })
    );
  });

  it('exposes a deterministic incorrect guess location away from the hidden point', () => {
    expect(getE2EIncorrectHideLocation()).toEqual({ x: 0.18, y: 0.18 });
  });

  describe('shape mode shims', () => {
    const SHAPE_OUTLINES = [
      ['hidden', E2E_SHAPE_POLYGON],
      ['hit', E2E_SHAPE_GUESS_HIT],
      ['miss', E2E_SHAPE_GUESS_MISS],
    ];

    it('expose closed normalized 3-decimal outlines with 4-6 vertices', () => {
      SHAPE_OUTLINES.forEach(([, outline]) => {
        expect(outline.length).toBeGreaterThanOrEqual(4);
        expect(outline.length).toBeLessThanOrEqual(6);
        expect(outline[0]).toEqual(outline[outline.length - 1]);

        outline.forEach((vertex) => {
          expect(Number.isFinite(vertex.x)).toBe(true);
          expect(Number.isFinite(vertex.y)).toBe(true);
          expect(vertex.x).toBeGreaterThanOrEqual(0);
          expect(vertex.x).toBeLessThanOrEqual(1);
          expect(vertex.y).toBeGreaterThanOrEqual(0);
          expect(vertex.y).toBeLessThanOrEqual(1);
          expect(vertex.x).toBe(Number(vertex.x.toFixed(3)));
          expect(vertex.y).toBe(Number(vertex.y.toFixed(3)));
        });
      });
    });

    it('exposes hit/miss variants through the shape outline accessor', () => {
      expect(getE2EShapeOutline('hit')).toEqual(E2E_SHAPE_GUESS_HIT);
      expect(getE2EShapeOutline('miss')).toEqual(E2E_SHAPE_GUESS_MISS);
      expect(getE2EShapeOutline('hit')).not.toBe(E2E_SHAPE_GUESS_HIT);
    });

    const SCREEN_GEOMETRIES = [
      { screenWidth: 320, screenHeight: 640, imageWidth: 320, imageHeight: 240 },
      { screenWidth: 390, screenHeight: 844, imageWidth: 390, imageHeight: 292 },
      { screenWidth: 768, screenHeight: 1024, imageWidth: 768, imageHeight: 576 },
      { screenWidth: 800, screenHeight: 360, imageWidth: 640, imageHeight: 288 },
    ];

    it('keeps the hit outline inside the hidden polygon corridor on representative screens', () => {
      SCREEN_GEOMETRIES.forEach((geometry) => {
        expect(
          isWinningTrace({
            hiddenShape: E2E_SHAPE_POLYGON,
            guessShape: E2E_SHAPE_GUESS_HIT,
            imageWidth: geometry.imageWidth,
            imageHeight: geometry.imageHeight,
          })
        ).toBe(true);
      });
    });

    it('keeps the miss outline disjoint from the hidden polygon corridor on representative screens', () => {
      SCREEN_GEOMETRIES.forEach((geometry) => {
        expect(
          isWinningTrace({
            hiddenShape: E2E_SHAPE_POLYGON,
            guessShape: E2E_SHAPE_GUESS_MISS,
            imageWidth: geometry.imageWidth,
            imageHeight: geometry.imageHeight,
          })
        ).toBe(false);
      });
    });

    it('seeds the point guess card with point-mode fields', () => {
      expect(buildE2EGuessCards()[0]).toEqual(
        expect.objectContaining({ mode: 'point', shape: null })
      );
    });

    it('carries mode and shape through the saved hide payload only in shape mode', () => {
      const shapeOutline = [
        { x: 0.2, y: 0.2 },
        { x: 0.6, y: 0.2 },
        { x: 0.2, y: 0.6 },
        { x: 0.2, y: 0.2 },
      ];

      const shapePayload = buildE2EHiddenGuessPayload({
        uri: 'file:///saved-shape.jpg',
        description: 'Trace the diamond',
        imageHeight: 240,
        imageWidth: 320,
        isPortrait: false,
        hiddenLocation: null,
        screenHeight: 640,
        screenWidth: 320,
        mode: 'shape',
        shape: shapeOutline,
      });
      expect(shapePayload.mode).toBe('shape');
      expect(shapePayload.shape).toEqual(shapeOutline);

      const pointPayload = buildE2EHiddenGuessPayload({
        uri: 'file:///saved-hide.jpg',
        description: 'Look near the barn',
        imageHeight: 240,
        imageWidth: 320,
        isPortrait: false,
        hiddenLocation: { x: 0.58, y: 0.46 },
        screenHeight: 640,
        screenWidth: 320,
      });
      expect('mode' in pointPayload).toBe(false);
      expect('shape' in pointPayload).toBe(false);
    });

    it('restores mode and shape from a shape-mode bridge payload and defaults to point', () => {
      const shapeOutline = [
        { x: 0.2, y: 0.2 },
        { x: 0.6, y: 0.2 },
        { x: 0.2, y: 0.6 },
        { x: 0.2, y: 0.2 },
      ];

      const shapeCard = buildE2EGuessCardFromPayload({
        uri: 'file:///saved-shape.jpg',
        pictureId: 'e2e-hidden-guess-card',
        mode: 'shape',
        shape: shapeOutline,
      });
      expect(shapeCard).toEqual(
        expect.objectContaining({ mode: 'shape', shape: shapeOutline })
      );

      const pointCard = buildE2EGuessCardFromPayload({
        uri: 'file:///saved-hide.jpg',
        pictureId: 'e2e-hidden-guess-card',
        hiddenLocation: { x: 0.58, y: 0.46 },
      });
      expect(pointCard).toEqual(
        expect.objectContaining({ mode: 'point', shape: null })
      );
    });
  });

  it('switches ad delay to zero only when e2e mode is enabled', () => {
    expect(isE2EMode()).toBe(false);
    expect(getE2EAdDelayMs()).toBe(5000);

    process.env.EXPO_PUBLIC_E2E_MODE = 'true';

    expect(isE2EMode()).toBe(true);
    expect(getE2EAdDelayMs()).toBe(0);
  });

  it('builds a deterministic e2e image rating with snake_case keys', () => {
    const expected = {
      global_rating: 4,
      quality_rating: 3,
      enigma_rating: 4,
      fun_rating: 3,
      difficulty_rating: 4,
    };

    expect(buildE2EImageRating('e2e-picture-1')).toEqual(expected);
    expect(buildE2EImageRating('e2e-picture-1')).toEqual(buildE2EImageRating('e2e-picture-1'));
    expect(buildE2EImageRating('e2e-picture-2')).toEqual(expected);
  });

  it('builds two deterministic e2e image tags with snake_case keys', () => {
    const expected = [
      { id: 'e2e-tag-1', name: 'hard', user_id: 'e2e-user', username: 'e2e-user' },
      { id: 'e2e-tag-2', name: 'night', user_id: 'e2e-user', username: 'e2e-user' },
    ];

    expect(buildE2EImageTags('e2e-picture-1')).toEqual(expected);
    expect(buildE2EImageTags('e2e-picture-1')).toEqual(buildE2EImageTags('e2e-picture-1'));
    expect(buildE2EImageTags('e2e-picture-2')).toEqual(expected);
  });

  it('builds a fully-populated deterministic e2e image detail object', () => {
    const expected = {
      category: {
        id: 'e2e-cat-nature',
        key: 'nature',
        name: 'Nature',
        thumbnailUrl: null,
        sortOrder: 0,
      },
      language: 'en',
      tags: [
        { id: 'e2e-tag-1', name: 'hard', user_id: 'e2e-user', username: 'e2e-user' },
        { id: 'e2e-tag-2', name: 'night', user_id: 'e2e-user', username: 'e2e-user' },
      ],
      creatorUsername: 'e2e-creator',
      createdAt: '2026-01-15T10:30:00Z',
      fullDescription: 'e2e full description',
      averageRating: 4,
      ratingsCount: 5,
    };

    expect(buildE2EImageDetail('e2e-picture-1')).toEqual(expected);
    expect(buildE2EImageDetail('e2e-picture-1')).toEqual(buildE2EImageDetail('e2e-picture-1'));
    expect(buildE2EImageDetail('e2e-picture-2')).toEqual(expected);
  });

  it('returns independent object references from e2e rating/tag/detail builders', () => {
    const ratingA = buildE2EImageRating();
    const ratingB = buildE2EImageRating();
    expect(ratingA).not.toBe(ratingB);
    expect(ratingA).toEqual(ratingB);

    const tagsA = buildE2EImageTags();
    const tagsB = buildE2EImageTags();
    expect(tagsA).not.toBe(tagsB);
    expect(tagsA[0]).not.toBe(tagsB[0]);

    const detailA = buildE2EImageDetail();
    const detailB = buildE2EImageDetail();
    expect(detailA).not.toBe(detailB);
    expect(detailA.category).not.toBe(detailB.category);
    expect(detailA.tags).not.toBe(detailB.tags);
    expect(detailA.tags[0]).not.toBe(detailB.tags[0]);
  });

  describe('e2e leaderboard fixtures', () => {
    it('carries user_id and per-mode split fields on every seeded ranking row', () => {
      const rows = buildE2ERankingRows();

      expect(rows).toHaveLength(10);
      rows.forEach((row) => {
        expect(Object.keys(row).sort()).toEqual([
          'point_score',
          'rank',
          'shape_score',
          'total_point_guess_score',
          'total_point_hide_score',
          'total_score',
          'total_shape_guess_score',
          'total_shape_hide_score',
          'user_id',
          'username',
        ]);
        expect(row.user_id).toMatch(/^e2e-user-/);
        expect(row.point_score).toBe(row.total_point_guess_score + row.total_point_hide_score);
        expect(row.shape_score).toBe(row.total_shape_guess_score + row.total_shape_hide_score);
        expect(row.total_score).toBe(row.point_score + row.shape_score);
      });

      expect(rows[0]).toEqual({
        rank: 1,
        username: 'John',
        total_score: 100,
        user_id: 'e2e-user-0',
        total_point_guess_score: 35,
        total_shape_guess_score: 35,
        total_point_hide_score: 15,
        total_shape_hide_score: 15,
        point_score: 50,
        shape_score: 50,
      });
    });

    it('returns total-ordered rows regardless of the requested board', () => {
      const totalEnvelope = buildE2ERankingResponse({ board: 'total' });
      const pointEnvelope = buildE2ERankingResponse({ board: 'point' });
      const shapeEnvelope = buildE2ERankingResponse({ board: 'shape', limit: 20 });

      const scores = totalEnvelope.rows.map((row) => row.total_score);
      for (let i = 1; i < scores.length; i += 1) {
        expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
      }

      expect(pointEnvelope.rows).toEqual(totalEnvelope.rows);
      expect(shapeEnvelope.rows).toEqual(totalEnvelope.rows);
    });

    it('returns a deterministic me-anchored me-window per period (contract v3 shim)', () => {
      const allEnvelope = buildE2ERankingResponse({ period: 'all' });
      const defaultEnvelope = buildE2ERankingResponse();
      const weekEnvelope = buildE2ERankingResponse({ period: 'week' });
      const dayEnvelope = buildE2ERankingResponse({ period: 'day' });

      expect(allEnvelope).toEqual(defaultEnvelope);
      expect(allEnvelope.rows.map((row) => Number(row.rank))).toEqual([10, 11, 12, 13, 14]);
      expect(weekEnvelope.rows.map((row) => Number(row.rank))).toEqual([5, 6, 7]);
      expect(dayEnvelope.rows.map((row) => Number(row.rank))).toEqual([1, 2, 3]);
      expect(weekEnvelope.rows).not.toEqual(allEnvelope.rows);

      [allEnvelope, weekEnvelope, dayEnvelope].forEach((envelope) => {
        envelope.rows.forEach((row) => {
          expect(row.user_id).toMatch(/^e2e-user-/);
          expect(row.total_score).toBe(row.point_score + row.shape_score);
          expect(row.score).toBe(row.total_score);
        });
      });

      expect(allEnvelope.me.rank).toBe(12);
      expect(weekEnvelope.me.rank).toBe(6);
      expect(dayEnvelope.me.rank).toBe(2);
      expect(weekEnvelope.me).toEqual({ ...allEnvelope.me, rank: 6 });

      expect(allEnvelope.meta).toEqual({ window: 5, limit: 20, board: 'total', period: 'all' });
      expect(dayEnvelope.meta).toEqual({ window: 3, limit: 20, board: 'total', period: 'day' });
    });

    it('exposes per-direction cursors on the initial envelope and no legacy next cursor', () => {
      const allEnvelope = buildE2ERankingResponse({ period: 'all' });
      const dayEnvelope = buildE2ERankingResponse({ period: 'day' });

      expect(allEnvelope).not.toHaveProperty('nextCursor');
      expect(allEnvelope).not.toHaveProperty('hasMore');
      expect(allEnvelope.upCursor).toBe('e2e-cursor-up');
      expect(allEnvelope.hasMoreUp).toBe(true);
      expect(allEnvelope.downCursor).toBe('e2e-cursor-down');
      expect(allEnvelope.hasMoreDown).toBe(true);

      expect(dayEnvelope.upCursor).toBeNull();
      expect(dayEnvelope.hasMoreUp).toBe(false);
      expect(dayEnvelope.downCursor).toBe('e2e-cursor-down');
    });

    it('serves direction-aware ranked continuation pages toward rank 1 and past the me-window (contract v3)', () => {
      const initial = buildE2ERankingResponse({ period: 'all' });

      const upPageOne = buildE2ERankingResponse({ period: 'all', after: initial.upCursor, direction: 'up' });
      expect(upPageOne.rows.map((row) => Number(row.rank))).toEqual([4, 5, 6, 7, 8, 9]);
      expect(upPageOne.nextCursor).toBe('e2e-cursor-up-3');
      expect(upPageOne.hasMore).toBe(true);

      const upPageTwo = buildE2ERankingResponse({ period: 'all', after: upPageOne.nextCursor, direction: 'up' });
      expect(upPageTwo.rows.map((row) => Number(row.rank))).toEqual([1, 2, 3]);
      expect(upPageTwo.nextCursor).toBeNull();
      expect(upPageTwo.hasMore).toBe(false);

      const downPageOne = buildE2ERankingResponse({ period: 'all', after: initial.downCursor, direction: 'down' });
      expect(downPageOne.rows.map((row) => Number(row.rank))).toEqual([15, 16, 17, 18, 19, 20]);
      expect(downPageOne.nextCursor).toBe('e2e-cursor-down-21');
      expect(downPageOne.hasMore).toBe(true);

      const downPageTwo = buildE2ERankingResponse({ period: 'all', after: downPageOne.nextCursor, direction: 'down' });
      expect(downPageTwo.rows.map((row) => Number(row.rank))).toEqual([21, 22, 23, 24, 25, 26]);

      const downPageThree = buildE2ERankingResponse({ period: 'all', after: downPageTwo.nextCursor, direction: 'down' });
      expect(downPageThree.rows.map((row) => Number(row.rank))).toEqual([27, 28, 29, 30]);
      expect(downPageThree.nextCursor).toBeNull();
      expect(downPageThree.hasMore).toBe(false);

      [upPageOne, upPageTwo, downPageOne, downPageTwo].forEach((envelope) => {
        envelope.rows.forEach((row) => {
          expect(Number.isInteger(row.rank)).toBe(true);
          expect(Number(row.rank)).toBeGreaterThan(0);
          expect(row.user_id).toMatch(/^e2e-user-/);
          expect(row.total_score).toBe(row.point_score + row.shape_score);
          expect(row.score).toBe(row.total_score);
        });
      });

      const initialIds = new Set(initial.rows.map((row) => row.user_id));
      [upPageOne, downPageOne].forEach((envelope) => {
        envelope.rows.forEach((row) => {
          expect(initialIds.has(row.user_id)).toBe(false);
        });
      });
    });

    it('exposes the me payload in every e2e ranking envelope', () => {
      const me = { user_id: 'e2e-user', username: 'e2e_user', total_score: 50, rank: 12 };

      expect(buildE2ERankingResponse().me).toEqual(me);
      expect(buildE2ERankingResponse({ page: 2 }).me).toEqual(me);
      expect(buildE2ERankingResponse({ after: 'e2e-cursor-up', direction: 'up' }).me).toEqual(me);
      expect(buildE2ERankingResponse({ after: 'e2e-cursor-down', direction: 'down' }).me).toEqual(me);
    });

    it('returns split-aware modal fields from buildE2EUserScores', () => {
      expect(buildE2EUserScores('John')).toEqual({
        total: {
          total_score: 100,
          total_hide_score: 30,
          total_guess_score: 70,
          total_point_guess_score: 35,
          total_shape_guess_score: 35,
          total_point_hide_score: 15,
          total_shape_hide_score: 15,
          point_score: 50,
          shape_score: 50,
        },
        hide_info: { hide_count: 2 },
        guess_info: { guess_count: 70 },
      });
    });

    it('falls back to the top row for unknown usernames without losing splits', () => {
      const scores = buildE2EUserScores('nobody-here');

      expect(scores.total.total_score).toBe(100);
      expect(scores.total.point_score).toBe(50);
      expect(scores.total.shape_score).toBe(50);
    });
  });
});