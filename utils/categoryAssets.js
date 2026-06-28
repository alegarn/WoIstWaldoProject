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

export function getCategoryAsset(key) {
  return CATEGORY_ASSETS[key];
}

export { CATEGORY_ASSETS };
