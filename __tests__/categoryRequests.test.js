jest.mock('axios', () => ({
  get: jest.fn(),
}));

jest.mock('../utils/e2eMode', () => ({
  buildE2ECategories: jest.fn(),
  isE2EMode: jest.fn(),
}));

import axios from 'axios';

import { buildE2ECategories, isE2EMode } from '../utils/e2eMode';
import { getCategories } from '../utils/categoryRequests';
import { DEFAULT_CATEGORIES } from '../constants/defaultCategories';

const EXPECTED_BUNDLED_KEYS = [
  'other',
  'nature',
  'city',
  'abstract',
  'animals',
  'food',
  'vehicles',
  'interiors',
  'landmarks',
];

describe('categoryRequests utilities', () => {
  const originalE2EMode = process.env.EXPO_PUBLIC_E2E_MODE;

  beforeEach(() => {
    jest.clearAllMocks();
    isE2EMode.mockReturnValue(false);
    buildE2ECategories.mockReturnValue([
      { id: 'e2e-default-category', key: 'all', name: 'Recent/All', thumbnailUrl: null, count: undefined },
    ]);
    delete process.env.EXPO_PUBLIC_E2E_MODE;
  });

  afterAll(() => {
    process.env.EXPO_PUBLIC_E2E_MODE = originalE2EMode;
  });

  it('returns the bundled default categories without any network call', async () => {
    const response = await getCategories({ context: { token: 'Bearer token' } });

    expect(axios.get).not.toHaveBeenCalled();
    expect(response).toEqual({
      data: DEFAULT_CATEGORIES.map((category) => expect.objectContaining({
        key: category.key,
        name: category.name,
        sortOrder: category.sortOrder,
        thumbnailUrl: expect.anything(),
      })),
    });
    expect(response.data).toHaveLength(EXPECTED_BUNDLED_KEYS.length);
    expect(response.data.map((category) => category.key)).toEqual(EXPECTED_BUNDLED_KEYS);
    response.data.forEach((category) => {
      expect(category).not.toHaveProperty('id');
    });
  });

  it('exposes exactly the nine bundled default category keys', () => {
    expect(DEFAULT_CATEGORIES.map((category) => category.key)).toEqual(EXPECTED_BUNDLED_KEYS);
    expect(DEFAULT_CATEGORIES).toHaveLength(9);
  });

  it('returns seeded e2e categories without calling axios when e2e mode is active', async () => {
    isE2EMode.mockReturnValue(true);
    buildE2ECategories.mockReturnValue([
      { id: 'e2e-default-category', key: 'all', name: 'Recent/All', thumbnailUrl: null, count: undefined },
      { id: 'e2e-cat-nature', key: 'nature', name: 'Nature', thumbnailUrl: null, count: undefined },
    ]);

    const response = await getCategories({ context: { token: 'Bearer token' } });

    expect(isE2EMode).toHaveBeenCalled();
    expect(buildE2ECategories).toHaveBeenCalled();
    expect(response).toEqual({
      data: [
        { id: 'e2e-default-category', key: 'all', name: 'Recent/All', thumbnailUrl: null, count: undefined },
        { id: 'e2e-cat-nature', key: 'nature', name: 'Nature', thumbnailUrl: null, count: undefined },
      ],
    });
    expect(axios.get).not.toHaveBeenCalled();
  });
});
