import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { ImageResult } from 'expo-image-manipulator';
import { File } from 'expo-file-system';

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
  const context = ImageManipulator.manipulate(uri);

  try {

    if (hasDims && Math.max(width, height) > maxLongestSide) {
      if (height >= width) {
        context.resize({ height: maxLongestSide });
      } else {
        context.resize({ width: maxLongestSide });
      }
    }

    const ref = await context.renderAsync();

    try {
      const saved: ImageResult = await ref.saveAsync({ compress, format });
      const contentLength = new File(saved.uri).size;
      if (!Number.isFinite(contentLength) || contentLength <= 0) {
        throw new Error('Could not determine resized image size.');
      }
      return { uri: saved.uri, contentLength, fileExtension: format };
    } finally {
      ref.release();
    }

  } finally {
    context.release();
  }
}
