import { SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import { scrubImageMetadata } from './imageMetadataScrub';

export type ResizeImageResult = {
  uri: string;
  contentLength: number;
  fileExtension: string;
};

export async function resizeImage({
  uri,
  width,
  height,
  maxLongestSide,
  compress = 0.7,
  format = SaveFormat.JPEG,
}: {
  uri: string;
  width: number;
  height: number;
  maxLongestSide: number;
  compress?: number;
  format?: SaveFormat;
}): Promise<ResizeImageResult> {
  const hasDims = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
  const resize = hasDims && Math.max(width, height) > maxLongestSide
    ? (height >= width
      ? { height: maxLongestSide }
      : { width: maxLongestSide })
    : undefined;

  const saved = await scrubImageMetadata({ uri, format, compress, resize });

  const contentLength = new File(saved.uri).size;
  if (!Number.isFinite(contentLength) || contentLength <= 0) {
    throw new Error('Could not determine resized image size.');
  }
  return { uri: saved.uri, contentLength, fileExtension: format };
}
