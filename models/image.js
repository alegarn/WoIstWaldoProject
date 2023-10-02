class Image {
  constructor(
    //accountId,
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
  ) {
    //this.accountId = accountId;
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
  };
};

export default Image;
