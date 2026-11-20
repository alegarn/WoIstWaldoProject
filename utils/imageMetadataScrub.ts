import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { ImageResult } from 'expo-image-manipulator';

/**
 * Explicit metadata-scrubbing re-encode for anything headed to backend storage.
 *
 * Contract: always decodes the source pixels and writes a brand-new
 * re-encoded file (it never returns the source uri), so no EXIF/GPS/timestamp
 * metadata from the source survives the "optimised image → backend storage"
 * boundary — the re-encode itself IS the scrub. Image orientation is applied
 * during decode (same behavior as the rest of the app).
 *
 * Transport must stay metadata-blind: utils/imagesRequests.ts
 * performImageUpload binary-PUTs the scrubbed bytes against a presigned URL
 * that declares their content_length, so re-encoding at the transport layer
 * would invalidate the signature. Route every optimisation step through this
 * wrapper instead.
 */
export async function scrubImageMetadata({
  uri,
  format,
  compress,
  resize,
}: {
  uri: string;
  format: SaveFormat;
  compress: number;
  resize?: { width?: number; height?: number };
}): Promise<ImageResult> {
  const context = ImageManipulator.manipulate(uri);
  try {
    if (resize) {
      context.resize(resize);
    }
    const ref = await context.renderAsync();
    try {
      return await ref.saveAsync({ compress, format });
    } finally {
      ref.release();
    }
  } finally {
    context.release();
  }
}
