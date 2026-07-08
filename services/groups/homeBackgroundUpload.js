import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';

import { preparePrivateUpload } from './groupUploadApi';
import { performImageUpload } from '../../utils/imagesRequests';

const MAX_WIDTH = 1080;

export async function uploadHomeBackground({ context, groupId }) {
  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: true,
    aspect: [4, 3],
    mediaTypes: ['images'],
  });
  if (result?.canceled || !result?.assets?.length) {
    return null;
  }

  const asset = result.assets[0];

  const manipulator = ImageManipulator.manipulate(asset.uri);
  if (asset.width && asset.width > MAX_WIDTH) {
    manipulator.resize({ width: MAX_WIDTH });
  }
  const rendered = await manipulator.renderAsync();
  const saved = await rendered.saveAsync({
    compress: 0.7,
    format: SaveFormat.JPEG,
  });
  const fileExtension = 'jpeg';

  let contentLength = asset.fileSize ?? 0;
  try {
    const renderedSize = new File(saved.uri).size;
    if (renderedSize) {
      contentLength = renderedSize;
    }
  } catch {
    // fall back to original asset size
  }

  const presignResponse = await preparePrivateUpload({
    context,
    groupId,
    kind: 'home-button-background',
    fileExtension,
    contentType: `image/${fileExtension}`,
    contentLength,
    isHomeButtonBackground: true,
  });
  if (presignResponse?.status !== 200 && presignResponse?.status !== 201) {
    throw new Error('Could not prepare upload.');
  }

  const uploadPlan = presignResponse.data;
  const uploadResponse = await performImageUpload({
    plan: uploadPlan,
    fileUrl: saved.uri,
    fileExtension,
    contentLength,
    context,
  });
  if (uploadResponse?.status !== 200 && uploadResponse?.status !== 204) {
    throw new Error('Upload failed.');
  }

  return { imageId: uploadPlan.imageId };
}
