const CATEGORY_ASSETS = {
  all: require('../assets/categories/all-image-cat.webp'),
  other: require('../assets/categories/other-image-cat.webp'),
  nature: require('../assets/categories/nature-image-cat.webp'),
  city: require('../assets/categories/city-image-cat.webp'),
  animals: require('../assets/categories/animals-image-cat.webp'),
  food: require('../assets/categories/food-image-cat.webp'),
  vehicles: require('../assets/categories/vehicles-image-cat.webp'),
  interiors: require('../assets/categories/interiors-image-cat.webp'),
  landmarks: require('../assets/categories/landmarks-image-cat.webp'),
  abstract: require('../assets/categories/abstract-image-cat.webp'),
};

const CATEGORY_NAME_TO_ASSET_KEY = {
  all: 'all',
  'recent/all': 'all',
  other: 'other',
  nature: 'nature',
  city: 'city',
  animals: 'animals',
  food: 'food',
  vehicles: 'vehicles',
  interiors: 'interiors',
  landmarks: 'landmarks',
  abstract: 'abstract',
};

function normalizeAssetLookupToken(value) {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ')
    : null;
}

export function getCategoryAsset(key) {
  return CATEGORY_ASSETS[key];
}

export function resolveCategoryAssetKey(category) {
  const explicitKey = normalizeAssetLookupToken(category?.key);
  if (explicitKey && CATEGORY_ASSETS[explicitKey]) {
    return explicitKey;
  }

  const normalizedName = normalizeAssetLookupToken(category?.name);
  return normalizedName ? CATEGORY_NAME_TO_ASSET_KEY[normalizedName] : undefined;
}

export function getCategoryAssetSource(category) {
  const assetKey = resolveCategoryAssetKey(category);
  return assetKey ? CATEGORY_ASSETS[assetKey] : undefined;
}

export { CATEGORY_ASSETS };
