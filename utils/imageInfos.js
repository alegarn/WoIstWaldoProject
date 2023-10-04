import * as FileSystem from 'expo-file-system';

export function handleImageType(uri) {
  const fileExtension = uri.substring(uri.lastIndexOf(".") + 1)
  return fileExtension
};

export function isTypeValid(fileExtension) {
  return ["jpg", "jpeg", "png"].includes(fileExtension);
};

export const handleContentLength = async (uri) => {
  const infos = await FileSystem.getInfoAsync(uri);
  return infos.size;
};
