import { useState } from 'react';
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
/*   const checkOrientation = async () => {
    const orientation = await ScreenOrientation.getOrientationAsync();
    setOrientation(orientation);
  };
 */


/*   const handleOrientationChange = (o) => {
    setOrientation(o.orientationInfo.orientation);
  }; */

  if (imageIsPortrait && isPortrait) {
    console.log("Portrait - ");
  };

};

const changeOrientation = async (newOrientation) => {
  console.log("newOrientation: ", newOrientation);
  await ScreenOrientation.lockAsync(newOrientation);
};

export const handleImageOrientation = async ({imageIsPortrait, isPortrait}) => {
  /* const orientation = await ScreenOrientation.getOrientationAsync();
  setOrientation(orientation); */

  console.log("imageIsPortrait: ", imageIsPortrait);
  console.log("isPortrait: ", isPortrait);

  if (!imageIsPortrait && isPortrait) {
    changeOrientation(ScreenOrientation.OrientationLock.LANDSCAPE_LEFT);
  }

  if (imageIsPortrait && !isPortrait) {
    console.log("ScreenOrientation.changeOrientation(ScreenOrientation.OrientationLock.PORTRAIT_RIGHT)");
  };

};
