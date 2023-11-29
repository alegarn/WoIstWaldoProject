function handleSmallPortraitDimensions({ imageHeight, screenHeight, ratios }) {

  let maxHeight = 0;
  let maxWidth = 0;

  (imageHeight < screenHeight) && (maxHeight = imageHeight);
  (imageHeight > screenHeight) && (maxHeight = screenHeight);
  maxWidth = maxHeight/ratios.imageRatio;
  return { maxHeight, maxWidth };
};

function handleLargePortraitDimensions({ imageHeight, imageWidth, screenHeight, screenWidth, ratios }) {
  const widthRatio = screenWidth / imageWidth;
  const heightRatio = screenHeight / imageHeight;

  let scaleFactor = Math.min(widthRatio, heightRatio);
  //console.log("widthRatio", widthRatio, "heightRatio", heightRatio, "scaleFactor", scaleFactor);
  if (scaleFactor > ratios.screenRatio) {
    scaleFactor = ratios.screenRatio; // Limit the scale factor to 1 to ensure the image is not larger than the screen
  };

  maxWidth = imageWidth * scaleFactor;
  maxHeight = imageHeight * scaleFactor;

  //console.log("1 maxWidth", maxWidth, "maxHeight", maxHeight);

  // Check if the image height is smaller than the screen height
  if (maxHeight < screenHeight) {
    // Resize the image until it reaches the border of the screen
    maxHeight = screenHeight;
    maxWidth = imageWidth * (screenHeight / imageHeight);
    //console.log("2 maxWidth ", maxWidth, "maxHeight", maxHeight);
    if (maxWidth <= screenWidth) {
      return { maxHeight, maxWidth };
    };
  };

  maxWidth = screenWidth;
  maxHeight = imageHeight * (screenWidth / imageWidth);
  //console.log("3 maxWidth ", maxWidth, "maxHeight", maxHeight);
  if (maxHeight <= screenHeight) {
    return { maxHeight, maxWidth };
  };

  return { maxHeight, maxWidth };
};

function handlePortraitDimensions({ imageHeight, imageWidth, screenHeight, screenWidth, ratios }) {

  if (imageWidth > screenWidth) {
    const { maxHeight, maxWidth } = handleLargePortraitDimensions({ imageHeight, imageWidth, screenHeight, screenWidth, ratios });
    return { maxHeight, maxWidth };
  };

  if (imageWidth < screenWidth) {
    const { maxHeight, maxWidth } = handleSmallPortraitDimensions({ imageHeight, screenHeight, ratios });
    return { maxHeight, maxWidth };
  };
};


function handleLargeLandscapeDimensions({ imageHeight, imageWidth, screenHeight, screenWidth, ratios }) {
  let maxWidth = 0;
  let maxHeight = 0;

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

  return { maxHeight, maxWidth };
};

function handleSmallLandscapeDimensions({ imageHeight, imageWidth, screenHeight, screenWidth, ratios }) {
  let maxHeight = 0;
  let maxWidth = 0;

  if (imageWidth < screenHeight) {
    maxWidth = imageWidth;
  };

  if (imageWidth > screenHeight) {
    maxWidth = screenHeight;
  };

  maxHeight = maxWidth/ratios.imageRatio;

  return { maxHeight, maxWidth };
};

function handleLandscapeDimensions({ imageHeight, imageWidth, screenHeight, screenWidth, ratios }) {

  if (imageHeight < screenWidth) {
    const { maxHeight, maxWidth } = handleSmallLandscapeDimensions({ imageHeight, imageWidth, screenHeight, screenWidth, ratios });
    return { maxHeight, maxWidth };
  };

  if ((imageHeight > screenWidth) && (imageWidth > screenHeight)) {
    const { maxHeight, maxWidth } = handleLargeLandscapeDimensions({ imageHeight, imageWidth, screenHeight, screenWidth, ratios });
    return { maxHeight, maxWidth };
  };
};


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

  if (isPortrait) {

    const { maxHeight, maxWidth } = handlePortraitDimensions({ imageHeight, imageWidth, screenHeight, screenWidth, ratios });
    return { maxHeight, maxWidth };

  } else {

    // is landscape
    const { maxHeight, maxWidth } = handleLandscapeDimensions({ imageHeight, imageWidth, screenHeight, screenWidth, ratios });
    return { maxHeight, maxWidth };

  };

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



