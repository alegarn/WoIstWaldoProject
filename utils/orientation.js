import * as ScreenOrientation from 'expo-screen-orientation';



export default function handleOrientation({ imageIsPortrait, isPortrait }) {
/*   const [orientation, setOrientation] = useState(null);


  const handleIfPortrait = () => {
    if (isPortrait) {
      setOrientation(2);
    };

    if (!isPortrait) {
      setOrientation(5);
    }
  } */




/*   const handleOrientationChange = (o) => {
    setOrientation(o.orientationInfo.orientation);
  }; */

  if (imageIsPortrait && isPortrait) {
    console.log("Portrait - ");
  };

};

const checkOrientation = async () => {
  const orientation = await ScreenOrientation.getOrientationAsync();
  console.log(orientation);
  return orientation;
};

const changeOrientation = async (newOrientation) => {
/*   console.log("newOrientation: ", newOrientation);
 */  await ScreenOrientation.lockAsync(newOrientation);
};

export const handleImageOrientation = async ({imageIsPortrait}) => {
  /* const orientation = await ScreenOrientation.getOrientationAsync();
  setOrientation(orientation); */
/*
  console.log("imageIsPortrait: ", imageIsPortrait);
  console.log("isPortrait: ", isPortrait);
 */

  const orientation = await checkOrientation();

  if ( (orientation === 3 || orientation === 4) && imageIsPortrait) {
    changeOrientation(ScreenOrientation.OrientationLock.PORTRAIT_RIGHT);
  }

  if ((orientation === 1 || orientation === 2) && !imageIsPortrait) {
    changeOrientation(ScreenOrientation.OrientationLock.LANDSCAPE_LEFT);
  };

};

export const backHomeScreen =  async () => {
  await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
};
