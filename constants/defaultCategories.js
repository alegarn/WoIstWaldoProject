import { getCategoryAsset } from '../utils/categoryAssets';

export const DEFAULT_CATEGORIES = [
  { key: 'other', name: 'Other', sortOrder: 1 },
  { key: 'nature', name: 'Nature', sortOrder: 2 },
  { key: 'city', name: 'City', sortOrder: 3 },
  { key: 'abstract', name: 'Abstract', sortOrder: 5 },
  { key: 'animals', name: 'Animals', sortOrder: 6 },
  { key: 'food', name: 'Food', sortOrder: 7 },
  { key: 'vehicles', name: 'Vehicles', sortOrder: 8 },
  { key: 'interiors', name: 'Interiors', sortOrder: 9 },
  { key: 'landmarks', name: 'Landmarks', sortOrder: 10 },
];

export function getDefaultCategories() {
  return {
    data: DEFAULT_CATEGORIES.map((category) => ({
      ...category,
      thumbnailUrl: getCategoryAsset(category.key),
    })),
  };
}
