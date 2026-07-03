import axios from 'axios';
import { File, Paths } from 'expo-file-system';
import { fromByteArray } from 'base64-js';

const THUMB_PREFIX = 'private-thumb-';
const DELETE_EXTENSIONS = ['png', 'jpeg', 'webp', 'jpg'];

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

function extFromContentType(contentType) {
  if (!contentType) return 'png';
  const ct = contentType.split(';')[0].toLowerCase();
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpeg';
  if (ct.includes('webp')) return 'webp';
  return 'png';
}

function bytesFromArrayBufferLike(data) {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return null;
}

export async function resolveCategoryThumbnail(context, { groupId, category } = {}) {
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
  try {
    response = await axios.get(presignedUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
    });
  } catch {
    return presignedUrl;
  }

  if (!response?.data) return presignedUrl;

  const bytes = bytesFromArrayBufferLike(response.data);
  if (!bytes) return presignedUrl;

  const finalExt = ext || extFromContentType(response.headers?.['content-type']);

  try {
    const file = new File(Paths.cache, `${THUMB_PREFIX}${groupId}-${imageId}.${finalExt}`);
    file.write(fromByteArray(bytes), { encoding: 'base64' });
    return file.uri;
  } catch {
    return presignedUrl;
  }
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
