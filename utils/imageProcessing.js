import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export const MAX_LONGEST_SIDE = 2560;
export const MIN_LONGEST_SIDE = 1200;

export async function processPickedImage({ uri, width, height }) {
  const hasDims = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
  if (hasDims && Math.max(width, height) < MIN_LONGEST_SIDE) {
    return { tooSmall: true };
  }

  // Import named members, NOT `import * as` — the module root has no
  // `manipulate` export; it is a method on the exported ImageManipulator
  // native-module object. Pattern already used in
  // services/groups/homeBackgroundUpload.js.
  const context = ImageManipulator.manipulate(uri);
  try {
    if (hasDims && Math.max(width, height) > MAX_LONGEST_SIDE) {
      if (height >= width) {
        context.resize({ height: MAX_LONGEST_SIDE });
      } else {
        context.resize({ width: MAX_LONGEST_SIDE });
      }
    }
    // Always re-save (not just when resized): normalizes HEIC/WebP/PNG to
    // JPEG so upload validation never rejects a pick late.
    const ref = await context.renderAsync();
    try {
      const result = await ref.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
      return { tooSmall: false, uri: result.uri, width: result.width, height: result.height };
    } finally {
      ref.release();
    }
  } finally {
    context.release();
  }
}
