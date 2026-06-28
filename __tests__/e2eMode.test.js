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
  buildE2ECategories,
  buildE2EGuessCardFromPayload,
  buildE2EGuessCards,
  buildE2EHiddenGuessPayload,
  buildE2EHideRouteParams,
  buildE2EImageDetail,
  buildE2EImageRating,
  buildE2EImageTags,
  buildE2EPictureSelection,
  getE2EAdDelayMs,
  getE2EIncorrectHideLocation,
  isE2EMode,
} from '../utils/e2eMode';

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
});