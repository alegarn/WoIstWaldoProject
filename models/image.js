class Image {
  constructor(
    accountId,
    imageFile,
    pictureId,
    description,
    imageHeight,
    imageWidth,
    isPortrait,
    touchLocation,
    screenHeight,
    screenWidth
  ) {
    this.accountId = accountId;
    this.imageFile = imageFile;
    this.pictureId = pictureId;
    this.description = description;
    this.imageHeight = imageHeight;
    this.imageWidth = imageWidth;
    this.isPortrait = isPortrait;
    this.touchLocation = touchLocation;
    this.screenHeight = screenHeight;
    this.screenWidth = screenWidth;
  }
}

export default Image;
