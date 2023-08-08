/* {"accountId": "1", "imageFile": "file:///data/user/0/host.exp.exponent/cache/ExperienceData/%2540anonymous%252FWoIstWaldoProject-235146bf-9d5d-410d-b01e-f25db89d03b9/ImagePicker/87ea6509-d775-4492-a153-32bae24c45af.jpeg", "pictureId": "1/image/hashed94viesov10j"} */
/* {"accountId": "1", "description": "the top right", "imageHeight": 719, "imageWidth": 1280, "isPortrait": false, "pictureId": "1/image/hashed94viesov10j", "screenHeight": 387.42857142857144, "screenWidth": 731.4285714285714, "touchLocation": {"x": "1.00", "y": "0.00"}} */

/* {"accountId": "1", "imageFile": "file:///data/user/0/host.exp.exponent/cache/ExperienceData/%2540anonymous%252FWoIstWaldoProject-235146bf-9d5d-410d-b01e-f25db89d03b9/ImagePicker/d9b3e987-1b19-44a1-a8de-962782ae14e3.jpeg", "pictureId": "1/image/hashednu8m36ed6z"} */
/* 2_cam {"accountId": "1", "description": "click", "imageHeight": 607, "imageWidth": 1080, "isPortrait": false, "pictureId": "1/image/hashednu8m36ed6z", "screenHeight": 387.42857142857144, "screenWidth": 731.4285714285714, "touchLocation": {"x": "0.38", "y": "0.46"}} */

/* {"accountId": "1", "imageFile": "file:///data/user/0/host.exp.exponent/cache/ExperienceData/%2540anonymous%252FWoIstWaldoProject-235146bf-9d5d-410d-b01e-f25db89d03b9/ImagePicker/d3c02d9a-5b9b-4853-8ad0-0fd01512d47f.jpeg", "pictureId": "1/image/hashedz2ss02tai1m"} */
/* 3_lense {"accountId": "1", "description": "lens center", "imageHeight": 2680, "imageWidth": 4764, "isPortrait": true, "pictureId": "1/image/hashedz2ss02tai1m", "screenHeight": 411.42857142857144, "screenWidth": 707.4285714285714, "touchLocation": {"x": "0.51", "y": "0.50"}} */
import { View, Text, Image } from 'react-native';
import {IMAGES} from "../data/dummy-data";

export default function GuessPathScreen({ navigation, route }) {


  function getImages() {
    console.log("1", IMAGES);
    return IMAGES;
  };

  const imageList = getImages();
  console.log(imageList[0].imageFile);

/* <Image style={styles.image} source={require('../assets/images/success-image.jpeg')} /> */
  return (
    <>
      <Text>Guess Path Screen</Text>
      <Image  source={{ uri: "file:///data/user/0/host.exp.exponent/cache/ExperienceData/%2540anonymous%252FWoIstWaldoProject-235146bf-9d5d-410d-b01e-f25db89d03b9/ImagePicker/c8b1d024-fc46-40bc-947f-136da04fb789.jpeg" }} style={{width: 300, height: 300}} />
    </>
  )
};
