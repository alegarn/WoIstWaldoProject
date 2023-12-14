import * as ScreenOrientation from 'expo-screen-orientation';


const checkOrientation = async () => {
  const orientation = await ScreenOrientation.getOrientationAsync();
  return orientation;
};

const changeOrientation = async (newOrientation) => {
  await ScreenOrientation.lockAsync(newOrientation);
};

export const handleOrientation = async (orientation) => {
/*   const [orientation, setOrientation] = useState(null); */
  const currentOrientation = await checkOrientation();

  if (orientation === "portrait" && (currentOrientation === 3 || currentOrientation === 4)) {
    await changeOrientation(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  };

  return null;
};

export const handleImageOrientation = async ({ imageIsPortrait }) => {

  const orientation = await checkOrientation();

  if ( imageIsPortrait && (orientation === 3 || orientation === 4)) {
    changeOrientation(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  };

  if ((orientation === 1 || orientation === 2) && !imageIsPortrait) {
    changeOrientation(ScreenOrientation.OrientationLock.LANDSCAPE_LEFT);
  };

  return null;
};


