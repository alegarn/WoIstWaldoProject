import { File, Paths } from 'expo-file-system';
import {
  usesBackendStorage,
  setStorageDownloadHeaders,
  getBackendHeaders,
} from '../../utils/imagesRequests';
import { downloadImageFile, extensionFromUrlPath } from '../../utils/imageDownloader';

export type ThumbnailCategory = {
  thumbnail_image_id?: string | number | null;
  thumbnail_url?: string | null;
  [key: string]: unknown;
};

const THUMB_PREFIX = 'private-thumb-';
const DELETE_EXTENSIONS = ['png', 'jpeg', 'webp', 'jpg', 'heic', 'heif', 'gif'];

function localThumbUri(groupId: string | number | null | undefined, id: string | number | null | undefined, ext: string) {
  return new File(Paths.cache, `${THUMB_PREFIX}${groupId}-${id}.${ext}`).uri;
}

function localThumbExists(groupId: string | number | null | undefined, id: string | number | null | undefined, ext: string) {
  try {
    return !!new File(localThumbUri(groupId, id, ext)).exists;
  } catch {
    return false;
  }
}

const inFlight = new Map<string, Promise<string | null>>();

async function doResolveCategoryThumbnail(
  context: unknown,
  { groupId, category }: { groupId?: string | number | null; category?: ThumbnailCategory | null } = {}
): Promise<string | null> {
  const imageId = category?.thumbnail_image_id;
  if (!imageId) return null;

  const presignedUrl = category?.thumbnail_url;
  if (!presignedUrl || typeof presignedUrl !== 'string') return null;

  const ext = extensionFromUrlPath(presignedUrl);

  if (ext && localThumbExists(groupId, imageId, ext)) {
    return localThumbUri(groupId, imageId, ext);
  }

  try {
    const headers = usesBackendStorage(presignedUrl)
      ? setStorageDownloadHeaders((await getBackendHeaders(context)).token)
      : undefined;
    const { fileUri } = await downloadImageFile({
      url: presignedUrl,
      directory: Paths.cache,
      name: `${THUMB_PREFIX}${groupId}-${imageId}`,
      preferredExtension: ext,
      headers,
    });
    return fileUri;
  } catch {
    return presignedUrl;
  }
}

export function resolveCategoryThumbnail(
  context: unknown,
  { groupId, category }: { groupId?: string | number | null; category?: ThumbnailCategory | null } = {}
): Promise<string | null> {
  const imageId = category?.thumbnail_image_id;
  if (!imageId) return Promise.resolve(null);

  const presignedUrl = category?.thumbnail_url;
  if (!presignedUrl || typeof presignedUrl !== 'string') return Promise.resolve(null);

  const key = `${groupId}:${imageId}`;
  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise: Promise<string | null> = doResolveCategoryThumbnail(context, { groupId, category }).finally(() => {
    if (inFlight.get(key) === promise) inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}

export function deleteCategoryThumbnailFile(groupId: string | number | null | undefined, id: string | number | null | undefined) {
  try {
    for (const ext of DELETE_EXTENSIONS) {
      const file = new File(Paths.cache, `${THUMB_PREFIX}${groupId}-${id}.${ext}`);
      if (file?.exists) file.delete();
    }
  } catch {
    // best-effort
  }
}

export function clearGroupThumbnails(groupId: string | number | null | undefined) {
  try {
    const cacheDir = Paths.cache;
    const entries = typeof cacheDir?.list === 'function' ? cacheDir.list() : [];
    if (!Array.isArray(entries)) return;

    const prefix = `${THUMB_PREFIX}${groupId}-`;
    for (const entry of entries) {
      const uri = typeof entry === 'string' ? entry : entry?.uri;
      const name = typeof uri === 'string' ? uri.split('/').pop() : '';
      if (!name || !name.startsWith(prefix)) continue;

      try {
        const file = new File(Paths.cache, name);
        if (file?.exists) file.delete();
      } catch {
        // best-effort
      }
    }
  } catch {
    // best-effort
  }
}
