import { SaveFormat } from 'expo-image-manipulator';
import { scrubImageMetadata } from './imageMetadataScrub';

export const MAX_LONGEST_SIDE = 2560;
export const MIN_LONGEST_SIDE = 1200;

export async function processPickedImage({ uri, width, height }) {
  const hasDims = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
  if (hasDims && Math.max(width, height) < MIN_LONGEST_SIDE) {
    return { tooSmall: true };
  }

  // Always scrub/re-save (not just when resized): the re-encode strips EXIF
  // metadata and normalizes HEIC/WebP/PNG to JPEG so upload validation never
  // rejects a pick late. See utils/imageMetadataScrub.ts.
  const resize = hasDims && Math.max(width, height) > MAX_LONGEST_SIDE
    ? (height >= width
      ? { height: MAX_LONGEST_SIDE }
      : { width: MAX_LONGEST_SIDE })
    : undefined;
  const result = await scrubImageMetadata({
    uri,
    format: SaveFormat.JPEG,
    compress: 0.8,
    resize,
  });
  return { tooSmall: false, uri: result.uri, width: result.width, height: result.height };
}
