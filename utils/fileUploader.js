/* https://snack.expo.dev/@rudiahmad/react-native-expo-how-to-upload-file-or-image-using-form-data-php */
/* https://docs.expo.dev/versions/latest/sdk/imagepicker/ */
/* https://github.com/expo/examples/tree/master/with-aws-storage-upload */


const exportImage = (image) => {
  // in the image storage
  console.log(image)
};

const exportPictureData = (pictureData) => {
  // to the server
  console.log(pictureData)
};


export function imageUploader({ uri, description, imageWidth, imageHeight, screenHeight, screenWidth, isPortrait, touchLocation }) {

  // user id (context)
  const accountId = "1";
  // picture id = user account Id / unique image data hashed
  const pictureId = accountId + "/image/hashed" + Math.random().toString( 36 ).substring( 2 );


  const imageFile = uri;



  const image = {
    accountId: accountId,
    pictureId: pictureId,
    imageFile: imageFile,
  };

  const pictureData = {
    accountId: accountId,
    pictureId: pictureId,
    description: description,
    imageWidth: imageWidth,
    imageHeight: imageHeight,
    screenHeight: screenHeight,
    screenWidth: screenWidth,
    isPortrait: isPortrait,
    touchLocation: touchLocation,
  }

  exportImage(image);
  exportPictureData(pictureData);
}
