export function setImageDimensions({
  imageHeight,
  imageWidth,
  screenHeight,
  screenWidth,
  isPortrait
}) {

  const dimensions = { screenHeight, screenWidth, imageWidth, imageHeight, isPortrait };
  const ratios = setRatios({ imageHeight, imageWidth, screenHeight, screenWidth, isPortrait });

  console.log("setImageDimensions", dimensions, ratios);


  let maxHeight = 0;
  let maxWidth = 0;


  if (isPortrait) {
    if (imageWidth > screenWidth) {
      /* (imageHeight > screenHeight) && (maxWidth = screenWidth);
      maxHeight = maxWidth*ratios.imageRatio; */
      const widthRatio = screenWidth / imageWidth;
      const heightRatio = screenHeight / imageHeight;

      let scaleFactor = Math.min(widthRatio, heightRatio);
      console.log("widthRatio", widthRatio, "heightRatio", heightRatio, "scaleFactor", scaleFactor);
      if (scaleFactor > ratios.screenRatio) {
        scaleFactor = ratios.screenRatio; // Limit the scale factor to 1 to ensure the image is not larger than the screen
      };

      maxWidth = imageWidth * scaleFactor;
      maxHeight = imageHeight * scaleFactor;

      console.log("1 maxWidth", maxWidth, "maxHeight", maxHeight);

      // Check if the image height is smaller than the screen height
      if (maxHeight < screenHeight) {
        // Resize the image until it reaches the border of the screen
        maxHeight = screenHeight;
        maxWidth = imageWidth * (screenHeight / imageHeight);
        console.log("2 maxWidth ", maxWidth, "maxHeight", maxHeight);
        if (maxWidth <= screenWidth) {
          return { maxHeight, maxWidth };
        };
      };

      maxWidth = screenWidth;
      maxHeight = imageHeight * (screenWidth / imageWidth);
      console.log("3 maxWidth ", maxWidth, "maxHeight", maxHeight);
      if (maxHeight <= screenHeight) {
        return { maxHeight, maxWidth };
      };
    };

    if (imageWidth < screenWidth) {
      (imageHeight < screenHeight) && (maxHeight = imageHeight);
      (imageHeight > screenHeight) && (maxHeight = screenHeight);
      maxWidth = maxHeight/ratios.imageRatio;
    };

  } else {
    // is landscape
    if ((imageHeight < screenWidth) && (imageWidth < screenHeight)) {
      maxWidth = imageWidth;
      maxHeight = maxWidth/ratios.imageRatio;
    };

    if ((imageHeight < screenWidth) && (imageWidth > screenHeight)) {
      (maxWidth = screenHeight);
      maxHeight = maxWidth/ratios.imageRatio;
    };


    if ((imageHeight > screenWidth) && (imageWidth > screenHeight)) {
      const widthRatio = screenWidth / imageWidth;
      const heightRatio = screenHeight / imageHeight;

      let scaleFactor = Math.min(widthRatio, heightRatio);
      console.log("widthRatio", widthRatio, "heightRatio", heightRatio, "scaleFactor", scaleFactor);
      if (scaleFactor > ratios.screenRatio) {
        scaleFactor = ratios.screenRatio; // Limit the scale factor to 1 to ensure the image is not larger than the screen
      };

      maxWidth = imageWidth * scaleFactor;
      maxHeight = imageHeight * scaleFactor;

      if (maxWidth < screenHeight) {
        // Resize the image until it reaches the border of the screen
        maxWidth = screenWidth;
        maxHeight = imageHeight * (screenWidth / imageWidth);
        if (maxHeight <= screenWidth) {
          return { maxHeight, maxWidth };
        };
      };

      // Check if the image height is smaller than the screen height
      if (maxHeight < screenWidth) {
        // Resize the image until it reaches the border of the screen
        maxHeight = screenHeight;
        maxWidth = imageWidth * (screenHeight / imageHeight);
      };
    };

  };
  return { maxHeight, maxWidth };

};

function setRatios({ imageHeight, imageWidth, screenHeight, screenWidth, isPortrait }) {
  if (isPortrait) {
    return { imageRatio: imageHeight / imageWidth, screenRatio: screenWidth / screenHeight };
  } else {
    return { imageRatio: imageWidth / imageHeight, screenRatio: screenHeight / screenWidth };
  };
};


export function handleCornersLocations({ imageHeight, imageWidth, screenHeight, screenWidth, isPortrait, touchLocation, targetSize }) {
  // orientation!!!
  // x ok, y 0
  console.log("wesh");
};
