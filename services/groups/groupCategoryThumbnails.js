import axios from 'axios';
import { File, Paths } from 'expo-file-system';
import { decodeImagePayload } from '../../utils/imageFormats';
import {
  usesBackendStorage,
  setStorageDownloadHeaders,
  getBackendHeaders,
} from '../../utils/imagesRequests';

const THUMB_PREFIX = 'private-thumb-';
const DELETE_EXTENSIONS = ['png', 'jpeg', 'webp', 'jpg', 'heic', 'heif', 'gif'];

function localThumbUri(groupId, id, ext) {
  return new File(Paths.cache, `${THUMB_PREFIX}${groupId}-${id}.${ext}`).uri;
}

function localThumbExists(groupId, id, ext) {
  try {
    return !!new File(localThumbUri(groupId, id, ext)).exists;
  } catch {
    return false;
  }
}

function deriveExtFromUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('.');
    const last = parts[parts.length - 1];
    if (last && /^[a-zA-Z0-9]{2,5}$/.test(last)) return last.toLowerCase();
  } catch {
    // not a URL
  }
  return null;
}

const inFlight = new Map();

async function doResolveCategoryThumbnail(context, { groupId, category } = {}) {
  const imageId = category?.thumbnail_image_id;
  if (!imageId) return null;

  const presignedUrl = category?.thumbnail_url;
  if (!presignedUrl || typeof presignedUrl !== 'string') return null;

  const ext = deriveExtFromUrl(presignedUrl);

  if (ext && localThumbExists(groupId, imageId, ext)) {
    return localThumbUri(groupId, imageId, ext);
  }

  try {
    Paths.cache.create({ idempotent: true, intermediates: true });
  } catch {
    // best-effort
  }

  let response;
  let decoded = null;
  try {
    if (usesBackendStorage(presignedUrl)) {
      const { token } = await getBackendHeaders(context);
      response = await axios.get(presignedUrl, {
        headers: setStorageDownloadHeaders(token),
        responseType: 'arraybuffer',
        timeout: 15000,
      });
    } else {
      response = await axios.get(presignedUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
      });
    }
    decoded = decodeImagePayload(response?.data, response?.headers?.['content-type']);
  } catch {
    return presignedUrl;
  }

  if (!decoded) return presignedUrl;

  const finalExt = ext || decoded.extension;

  try {
    const file = new File(Paths.cache, `${THUMB_PREFIX}${groupId}-${imageId}.${finalExt}`);
    file.write(decoded.base64, { encoding: 'base64' });
    return file.uri;
  } catch {
    return presignedUrl;
  }
}

export function resolveCategoryThumbnail(context, { groupId, category } = {}) {
  const imageId = category?.thumbnail_image_id;
  if (!imageId) return Promise.resolve(null);

  const presignedUrl = category?.thumbnail_url;
  if (!presignedUrl || typeof presignedUrl !== 'string') return Promise.resolve(null);

  const key = `${groupId}:${imageId}`;
  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = doResolveCategoryThumbnail(context, { groupId, category }).finally(() => {
    if (inFlight.get(key) === promise) inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}

export function deleteCategoryThumbnailFile(groupId, id) {
  try {
    for (const ext of DELETE_EXTENSIONS) {
      const file = new File(Paths.cache, `${THUMB_PREFIX}${groupId}-${id}.${ext}`);
      if (file?.exists) file.delete();
    }
  } catch {
    // best-effort
  }
}

export function clearGroupThumbnails(groupId) {
  try {
    const cacheDir = Paths.cache;
    const entries = typeof cacheDir?.list === 'function' ? cacheDir.list() : [];
    if (!Array.isArray(entries)) return;

    const prefix = `${THUMB_PREFIX}${groupId}-`;
    for (const entry of entries) {
      const uri = typeof entry === 'string' ? entry : entry?.uri;
      const name = typeof uri === 'string' ? uri.split('/').pop() : '';
      if (!name.startsWith(prefix)) continue;

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
