export const MOCK_IMAGE_DETAILS = {
  full: {
    category: {
      id: 'cat-3',
      key: 'nature',
      name: 'Nature',
      thumbnail_url: require('../assets/tutorial/farm_pict_hide_320.jpg'),
    },
    language: 'en',
    ratings_average: 3.5,
    ratings_count: 7,
    averageRating: 4.5,
    ratingsCount: 9,
    ratings: {
      global_rating: 4,
      quality_rating: 3,
      enigma_rating: 4,
      fun_rating: 5,
      difficulty_rating: 2,
    },
    tags: ['Hard', 'Night', 'Confusing'],
    creator_username: 'waldo_master',
    created_at: '2026-05-15T10:30:00Z',
    full_description:
      'Hidden near the old oak tree behind the barn. The shadow points north at noon.',
  },
  sparse: {
    category: {
      id: 'cat-4',
      key: 'city',
      name: 'City',
      thumbnail_url: require('../assets/tutorial/farm_pict_guess_320.jpg'),
    },
    language: 'fr',
    ratings_average: 2.0,
    ratings_count: 3,
    averageRating: 2.0,
    ratingsCount: 3,
    ratings: undefined,
    tags: undefined,
    creator_username: undefined,
    created_at: '2026-04-02T18:45:00Z',
    full_description:
      'Look between the red mailbox and the third streetlamp after dusk.',
  },
};
