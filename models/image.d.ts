/**
 * Type declarations for `models/image.js`. The runtime module is a plain
 * JavaScript class whose constructor/property values come from heterogeneous
 * writers (public metadata rows in `utils/imagesRequests.ts`, private feed
 * rows in `services/groups/groupFeedApi.ts`, e2e builders in
 * `utils/e2eMode.js`) — several fields are nullable or absent per writer, so
 * the property contract is `unknown` plus an index signature for the fields
 * attached after construction (averageRating, category, hiddenLocation, ...).
 */

export default class Image {
  constructor(
    imageFile?: unknown,
    pictureId?: unknown,
    description?: unknown,
    imageHeight?: unknown,
    imageWidth?: unknown,
    isPortrait?: unknown,
    touchLocation?: unknown,
    screenHeight?: unknown,
    screenWidth?: unknown,
    listId?: unknown,
    averageRating?: unknown,
    ratingsCount?: unknown,
    creatorUsername?: unknown,
    createdAt?: unknown,
    fullDescription?: unknown,
    language?: unknown,
    category?: unknown,
  );

  imageFile: unknown;
  pictureId: unknown;
  description: unknown;
  imageHeight: unknown;
  imageWidth: unknown;
  isPortrait: unknown;
  touchLocation: unknown;
  screenHeight: unknown;
  screenWidth: unknown;
  listId: unknown;
  averageRating: unknown;
  ratingsCount: unknown;
  creatorUsername: unknown;
  createdAt: unknown;
  fullDescription: unknown;
  language: unknown;
  category: unknown;
  [key: string]: unknown;
}
