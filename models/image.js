class Image {
  constructor(
    imageFile,
    pictureId,
    description,
    imageHeight,
    imageWidth,
    isPortrait,
    touchLocation,
    screenHeight,
    screenWidth,
    listId,
    averageRating,
    ratingsCount,
    creatorUsername,
    createdAt,
    fullDescription,
    language,
    category,
  ) {
    this.imageFile = imageFile;
    this.pictureId = pictureId;
    this.description = description;
    this.imageHeight = imageHeight;
    this.imageWidth = imageWidth;
    this.isPortrait = isPortrait;
    this.touchLocation = touchLocation;
    this.screenHeight = screenHeight;
    this.screenWidth = screenWidth;
    this.listId = listId;
    this.averageRating = averageRating;
    this.ratingsCount = ratingsCount;
    this.creatorUsername = creatorUsername;
    this.createdAt = createdAt;
    this.fullDescription = fullDescription;
    this.language = language;
    this.category = category;
  };
};

export default Image;
