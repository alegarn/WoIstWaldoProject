/* https://snack.expo.dev/@rudiahmad/react-native-expo-how-to-upload-file-or-image-using-form-data-php */
/* https://docs.expo.dev/versions/latest/sdk/imagepicker/ */
/* https://github.com/expo/examples/tree/master/with-aws-storage-upload */

import * as FileSystem from "expo-file-system";
import { handleContentLength } from "./imageInfos";
import { prepareImageUpload, performImageUpload, saveImageInfos } from "./imagesRequests";
import { checkSecureStoreItem } from "./auth";
import { isE2EMode } from './e2eMode';

async function handlePrepareImageUpload({ context, contentLength, fileExtension }) {

  const response = await prepareImageUpload(context, {
    contentType: `image/${fileExtension}`,
    contentLength: contentLength,
  });

  return { status: response.status, title: response.title, message: response.message, data: response.data };
};




const exportImage = async ({ uploadPlan, uri, fileExtension, contentLength, context }) => {
  console.log("exportImage");
  const isSaved = await performImageUpload({
    plan: uploadPlan,
    fileUrl: uri,
    fileExtension: fileExtension,
    contentLength: contentLength,
    context: context,
  });
  return isSaved;
};

const exportPictureData = async ({ imagesInfos, context }) => {

  const userId = await checkSecureStoreItem({ secureStoreValue: "userId", context });
  const saveImageResponse = saveImageInfos({
    userId: userId,
    imagesInfos: {
      name: imagesInfos.name,
      file_extension: imagesInfos.fileExtension,
      image_height: imagesInfos.imageHeight,
      image_width: imagesInfos.imageWidth,
      screen_height: imagesInfos.screenHeight,
      screen_width: imagesInfos.screenWidth,
      description: imagesInfos.description,
      is_portrait: imagesInfos.isPortrait,
      x_location: imagesInfos.xLocation,
      y_location: imagesInfos.yLocation,

      /* file_type, file_size */
    },
    context: context,
  });

  return saveImageResponse
};


export async function imageUploader({ imageInfos, context }) {
  if (isE2EMode()) {
    return { status: 200 };
  }

  const imageLocalUri = imageInfos.uri;
  const contentLength = await handleContentLength(imageLocalUri);
  const uploadUrlData = await handlePrepareImageUpload({
    context,
    contentLength,
    fileExtension: imageInfos.fileExtension,
  });

  if (uploadUrlData.status !== 200) {
    return uploadUrlData;
  };

  const userId = await checkSecureStoreItem({ secureStoreValue: "userId", context });

  const exportImageData = await exportImage({
    uploadPlan: uploadUrlData.data,
    uri: imageInfos.uri,
    fileExtension: imageInfos.fileExtension,
    contentLength,
    context,
  });

  if (exportImageData.status !== 200) {
    return exportImageData;
  };

  const imageInfosSaved = await exportPictureData({
    imagesInfos: {
      userId: userId,
      name: uploadUrlData.data.image_key,
      fileExtension: imageInfos.fileExtension,
      imageHeight: imageInfos.imageHeight,
      imageWidth: imageInfos.imageWidth,
      screenHeight: imageInfos.screenHeight,
      screenWidth: imageInfos.screenWidth,
      description: imageInfos.description,
      isPortrait: imageInfos.isPortrait,
      xLocation: imageInfos.xLocation,
      yLocation: imageInfos.yLocation,
    },
    context: context
  });
  console.log("imageInfosSaved", imageInfosSaved);
  if (imageInfosSaved.status !== 200) {
    return imageInfosSaved;
  };

  await FileSystem.deleteAsync(imageLocalUri);

  /* delete */

  return { status: 200 };
};
