/* https://snack.expo.dev/@rudiahmad/react-native-expo-how-to-upload-file-or-image-using-form-data-php */
/* https://docs.expo.dev/versions/latest/sdk/imagepicker/ */
/* https://github.com/expo/examples/tree/master/with-aws-storage-upload */
import saveImages from "./requests";


const exportImage = (image) => {
  // in the image storage
  console.log(image)
};

const exportPictureData = (pictureData, context) => {

  const saveImageResponse = saveImages({
    token: context.token,
    uid: context.uid,
    userId: context.userId,
    expiry: context.expiry,
    access_token: context.access_token,
    client: context.client,
    imagesInfos: pictureData
  });

  console.log("saveImageResponse", saveImageResponse)
};


export function imageUploader({ imageInfos, context }) {

  const imageFile = imageInfos.uri;

  const image = {
    userId: context.userId,
    imageFile: imageFile,
  };

  const pictureData = {
    user_id: context.userId,
    description: imageInfos.description,
    image_height: imageInfos.imageHeight,
    image_width: imageInfos.imageWidth,
    screen_height: imageInfos.screenHeight,
    screen_width: imageInfos.screenWidth,
    is_portrait: imageInfos.isPortrait,
    x_location: imageInfos.touchLocation.x,
    y_location: imageInfos.touchLocation.y
  };

  exportImage(image);
  exportPictureData(pictureData, context);
};
