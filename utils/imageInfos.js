import * as FileSystem from 'expo-file-system';

export function handleImageType(uri) {
  const fileType = uri.substring(uri.lastIndexOf(".") + 1)
  return fileType
};

export function isTypeValid(fileType) {
  return ["jpg", "jpeg", "png"].includes(fileType);
};

export const handleContentLength = async (uri) => {
  const infos = await FileSystem.getInfoAsync(uri);
  return infos.size;
};
