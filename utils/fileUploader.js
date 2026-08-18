/* https://snack.expo.dev/@rudiahmad/react-native-expo-how-to-upload-file-or-image-using-form-data-php */
/* https://docs.expo.dev/versions/latest/sdk/imagepicker/ */
/* https://github.com/expo/examples/tree/master/with-aws-storage-upload */

import { File } from "expo-file-system";
import { handleContentLength } from "./imageInfos";
import { prepareImageUpload, performImageUpload, saveImageInfos } from "./imagesRequests";
import { checkSecureStoreItem } from "./auth";
import { preparePrivateUpload } from "../services/groups/groupUploadApi";

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
      language: imagesInfos.language,
      category_key: imagesInfos.categoryKey,

      /* file_type, file_size */
    },
    context: context,
  });

  return saveImageResponse
};

async function exportPrivatePictureData({ imageInfos, context, groupId, contentLength }) {
  const response = await preparePrivateUpload({
    context,
    groupId,
    kind: 'guess',
    fileExtension: imageInfos.fileExtension,
    contentType: `image/${imageInfos.fileExtension}`,
    contentLength,
    categoryId: imageInfos.categoryId,
    description: imageInfos.description,
    imageHeight: imageInfos.imageHeight,
    imageWidth: imageInfos.imageWidth,
    screenHeight: imageInfos.screenHeight,
    screenWidth: imageInfos.screenWidth,
    isPortrait: imageInfos.isPortrait,
    xLocation: imageInfos.xLocation,
    yLocation: imageInfos.yLocation,
    language: imageInfos.language,
  });

  if (response.status !== 200 && response.status !== 201) {
    return response;
  }

  return performImageUpload({
    plan: {
      provider: response.data.provider,
      method: response.data.method,
      url: response.data.url,
      headers: response.data.headers,
      image_key: response.data.imageKey,
    },
    fileUrl: imageInfos.uri,
    fileExtension: imageInfos.fileExtension,
    contentLength,
    context,
  });
}


export async function imageUploader({ imageInfos, context, scope }) {
  const imageLocalUri = imageInfos.uri;
  const contentLength = await handleContentLength(imageLocalUri);

  if (scope?.kind === 'private' && scope?.groupId) {
    const exportImageData = await exportPrivatePictureData({
      imageInfos,
      context,
      groupId: scope.groupId,
      contentLength,
    });

    if (exportImageData.status !== 200) {
      return exportImageData;
    }

    const imageFile = new File(imageLocalUri);
    imageFile.delete();

    return { status: 200 };
  }

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
      language: imageInfos.language,
      categoryKey: imageInfos.categoryKey,
    },
    context: context
  });
  console.log("imageInfosSaved", imageInfosSaved);
  if (imageInfosSaved.status !== 200) {
    return imageInfosSaved;
  };

  const imageFile = new File(imageLocalUri);
  imageFile.delete();

  /* delete */

  return { status: 200 };
};
