import * as ScreenOrientation from 'expo-screen-orientation';


const checkOrientation = async () => {
  const orientation = await ScreenOrientation.getOrientationAsync();
  return orientation;
};

const changeOrientation = async (newOrientation) => {
  await ScreenOrientation.lockAsync(newOrientation);
};

export const handleOrientation = async (orientation) => {
  // 4
  console.log("handleOrientation", orientation);
/*   const [orientation, setOrientation] = useState(null); */
  const currentOrientation = await checkOrientation();

  if (orientation === "portrait" && (currentOrientation === 3 || currentOrientation === 4)) {
    await changeOrientation(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  };

  return null;
};

export const handleImageOrientation = async ({ imageIsPortrait }) => {

  const currentLock = await ScreenOrientation.getOrientationLockAsync();
  const desiredLock = imageIsPortrait
    ? ScreenOrientation.OrientationLock.PORTRAIT_UP
    : ScreenOrientation.OrientationLock.LANDSCAPE_LEFT;

  if (currentLock === desiredLock) {
    return null;
  };

  await changeOrientation(desiredLock);

  return null;
};


