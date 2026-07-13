const TARGET_SIZE_RATIO = 0.05;
const DRAG_AREA_MULTIPLIER = 2;

function determineLocation({locationX, locationY, newImageWidth, newImageHeight}) {
  const touchX = (locationX / newImageWidth).toFixed(2);
  const touchY = (locationY / newImageHeight).toFixed(2);
  return { x: touchX, y: touchY };
};

export function determineImageCorners({ maxImageHeight, maxImageWidth, screenWidth, screenHeight }) {
  const centerX = screenWidth / 2;
  const centerY = screenHeight / 2;

  const imageHalfWidth = maxImageWidth / 2;
  const imageHalfHeight = maxImageHeight / 2;

  const topLeft = {
    x: centerX - imageHalfWidth,
    y: centerY - imageHalfHeight,
  };

  return { topLeft: topLeft };
};

function handleTargetSize(screenWidth, screenHeight) {
  const targetSize = Math.min(screenWidth, screenHeight) * TARGET_SIZE_RATIO;
  return targetSize;
};
function setTarget({ locationX, locationY, targetSize }) {
  const targetStyle = {
    position: 'absolute',
    width: targetSize,
    height: targetSize,
    left: locationX - targetSize / 2, // Adjusted to center the icon horizontally
    top: locationY - targetSize / 2, // Adjusted to center the icon vertically
  };

  const dragSize = targetSize * DRAG_AREA_MULTIPLIER;
  const dragStyle = {
    position: 'absolute',
    width: dragSize,
    height: dragSize,
    left: locationX - dragSize / 2,
    top: locationY - dragSize / 2,
    borderRadius: dragSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
  };

  const target = { targetSize: targetSize, targetStyle: targetStyle, dragSize: dragSize, dragStyle: dragStyle };
  return target;
};

export const handlePicturePress = ({event, screenHeight, screenWidth, imageDimensionStyle}) => {
  const { locationX, locationY } = event.nativeEvent;

  const newImageWidth = imageDimensionStyle.width;
  const newImageHeight = imageDimensionStyle.height;

  // Check if the touch event is within the image boundaries
  if (
    locationX >= 0 &&
    locationX <= newImageWidth &&
    locationY >= 0 &&
    locationY <= newImageHeight
  ) {

    return buildSelectionFromPixels({ locationX, locationY, screenWidth, screenHeight, imageDimensionStyle });

  };
  return ({ location: null, target: null });
};

export function buildSelectionFromPixels({ locationX, locationY, screenWidth, screenHeight, imageDimensionStyle }) {
  const newImageWidth = imageDimensionStyle.width;
  const newImageHeight = imageDimensionStyle.height;

  const location = determineLocation({ locationX, locationY, newImageWidth, newImageHeight });
  const targetSize = handleTargetSize(screenWidth, screenHeight);
  const target = setTarget({ locationX, locationY, targetSize });

  return { location, target };
};

export function buildCenteredTarget({ screenWidth, screenHeight, imageDimensionStyle }) {
  return buildSelectionFromPixels({
    locationX: imageDimensionStyle.width / 2,
    locationY: imageDimensionStyle.height / 2,
    screenWidth,
    screenHeight,
    imageDimensionStyle,
  });
};

function targetAbsoluteLocation(hiddenRelativeLocation, screenWidth, screenHeight) {
  // Convert relative coordinates to absolute coordinates
  const x = hiddenRelativeLocation.x * screenWidth;
  const y = hiddenRelativeLocation.y * screenHeight;

  // Return the absolute location as an object
  return { x, y };
};

function determineIsOnTarget({hiddenTrgtAbsLoc, guessTrgtAbsLoc, targetSize}) {
  // Calculate the absolute distance between the hidden target and the guess target
  const distance = Math.sqrt(
    Math.pow(hiddenTrgtAbsLoc.x - guessTrgtAbsLoc.x, 2) +
    Math.pow(hiddenTrgtAbsLoc.y - guessTrgtAbsLoc.y, 2)
  );

  // Define a threshold for determining if the guess is on target
  const HIT_THRESHOLD = targetSize;
  const threshold = HIT_THRESHOLD; // Adjust this value as needed

  // Check if the distance is within the threshold
  if (distance <= threshold) {
    return true; // Guess is on target
  } else {
    return false; // Guess is not on target
  };
}

export const isOnTarget = ({ location, hiddenLocation, screenWidth, screenHeight }) => {

  const targetSize = handleTargetSize(screenWidth, screenHeight);

  const hiddenTrgtAbsLoc = targetAbsoluteLocation(hiddenLocation, screenWidth, screenHeight);
  const guessTrgtAbsLoc = targetAbsoluteLocation(location, screenWidth, screenHeight);

  const isOnTarget = determineIsOnTarget({ hiddenTrgtAbsLoc, guessTrgtAbsLoc, targetSize })
  return isOnTarget;
};
