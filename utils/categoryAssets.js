const CATEGORY_ASSETS = {
  all: require('../assets/categories/all-image-cat.png'),
  other: require('../assets/categories/other-image-cat.png'),
  nature: require('../assets/categories/nature-image-cat.png'),
  city: require('../assets/categories/city-image-cat.png'),
  animals: require('../assets/categories/animals-image-cat.png'),
  food: require('../assets/categories/food-image-cat.png'),
  vehicles: require('../assets/categories/vehicles-image-cat.png'),
  interiors: require('../assets/categories/interiors-image-cat.png'),
  landmarks: require('../assets/categories/landmarks-image-cat.png'),
  abstract: require('../assets/categories/abstract-image-cat.png'),
};

export function getCategoryAsset(key) {
  return CATEGORY_ASSETS[key];
}

export { CATEGORY_ASSETS };
