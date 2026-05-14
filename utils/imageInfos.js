import * as FileSystem from 'expo-file-system';

export function handleImageType(uri) {
  const normalizedUri = String(uri ?? '').split('?')[0].split('#')[0];
  const extensionStartIndex = normalizedUri.lastIndexOf('.');

  if (extensionStartIndex === -1 || extensionStartIndex === normalizedUri.length - 1) {
    return '';
  }

  return normalizedUri.substring(extensionStartIndex + 1).toLowerCase();
};

export function isTypeValid(fileExtension) {
  return ["jpg", "jpeg", "png"].includes(fileExtension);
};

export const handleContentLength = async (uri) => {
  const infos = await FileSystem.getInfoAsync(uri);
  return infos.size;
};
