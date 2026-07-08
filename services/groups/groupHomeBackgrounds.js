import axios from 'axios';
import { File, Directory, Paths } from 'expo-file-system';
import { fromByteArray } from 'base64-js';
import {
  usesBackendStorage,
  setStorageDownloadHeaders,
  getBackendHeaders,
} from '../../utils/imagesRequests';

export const SLOTS = ['hide', 'find', 'ranking'];

const HOME_BG_DIR = 'private-home-bg';
const DELETE_EXTENSIONS = ['png', 'jpeg', 'webp', 'jpg'];

function groupDir(groupId) {
  return new Directory(Paths.cache, HOME_BG_DIR, String(groupId));
}

function localHomeBgFile(groupId, slot, imageId, ext) {
  return new File(
    Paths.cache,
    HOME_BG_DIR,
    String(groupId),
    `${slot}-${imageId}.${ext}`
  );
}

function localHomeBgUri(groupId, slot, imageId, ext) {
  return localHomeBgFile(groupId, slot, imageId, ext).uri;
}

function localHomeBgExists(groupId, slot, imageId, ext) {
  try {
    return !!localHomeBgFile(groupId, slot, imageId, ext).exists;
  } catch {
    return false;
  }
}

function ensureGroupDir(groupId) {
  const dir = groupDir(groupId);
  try {
    dir.create({ idempotent: true, intermediates: true });
    return;
  } catch {
    // A prior build may have created a FILE at this path; clear it and retry.
  }
  try {
    const stale = new File(Paths.cache, HOME_BG_DIR, String(groupId));
    if (stale.exists) stale.delete();
    dir.create({ idempotent: true, intermediates: true });
  } catch {
    // best-effort
  }
}

function bytesFromArrayBufferLike(data) {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return null;
}

function extractBase64FromDataUrl(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^data:image\/(?:png|jpe?g|gif|webp|heic|heif);base64,([\s\S]*)$/);
  return match ? match[1] : null;
}

function extFromContentType(contentType) {
  if (!contentType) return 'png';
  const ct = contentType.split(';')[0].toLowerCase();
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpeg';
  if (ct.includes('webp')) return 'webp';
  return 'png';
}

function normalizeExt(ext) {
  if (typeof ext !== 'string' || !ext) return null;
  const trimmed = ext.replace(/^\./, '').toLowerCase();
  return /^[a-zA-Z0-9]{2,5}$/.test(trimmed) ? trimmed : null;
}

export async function resolveHomeBackground({
  context,
  groupId,
  slot,
  imageId,
  fileExtension,
  url,
}) {
  if (!imageId || !SLOTS.includes(slot)) return null;

  const ext = normalizeExt(fileExtension);

  if (ext && localHomeBgExists(groupId, slot, imageId, ext)) {
    return localHomeBgUri(groupId, slot, imageId, ext);
  }

  if (!url || typeof url !== 'string') return null;

  ensureGroupDir(groupId);

  const isBackend = usesBackendStorage(url);
  let response;
  let base64ToWrite = null;
  try {
    if (isBackend) {
      const { token } = await getBackendHeaders(context);
      response = await axios.get(url, {
        headers: setStorageDownloadHeaders(token),
        responseType: 'text',
        timeout: 15000,
      });
      base64ToWrite = extractBase64FromDataUrl(response?.data);
    } else {
      response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 15000,
      });
      const bytes = bytesFromArrayBufferLike(response?.data);
      base64ToWrite = bytes ? fromByteArray(bytes) : null;
    }
  } catch (err) {
    return isBackend ? null : url;
  }

  if (!base64ToWrite) return isBackend ? null : url;

  const finalExt = ext || extFromContentType(response?.headers?.['content-type']);
  if (!finalExt) return isBackend ? null : url;

  try {
    const file = localHomeBgFile(groupId, slot, imageId, finalExt);
    file.write(base64ToWrite, { encoding: 'base64' });
    return file.uri;
  } catch (err) {
    return isBackend ? null : url;
  }
}

export function deleteHomeBackgroundFile(groupId, slot, imageId) {
  try {
    for (const ext of DELETE_EXTENSIONS) {
      const file = localHomeBgFile(groupId, slot, imageId, ext);
      if (file?.exists) file.delete();
    }
  } catch {
    // best-effort
  }
}

export function clearGroupHomeBackgrounds(groupId) {
  try {
    const dir = groupDir(groupId);
    if (!dir?.exists) return;

    const entries = typeof dir.list === 'function' ? dir.list() : [];
    if (Array.isArray(entries)) {
      for (const entry of entries) {
        const uri = typeof entry === 'string' ? entry : entry?.uri;
        const name = typeof uri === 'string' ? uri.split('/').pop() : '';
        if (!name) continue;
        try {
          const child = new File(Paths.cache, HOME_BG_DIR, String(groupId), name);
          if (child?.exists) child.delete();
        } catch {
          // best-effort
        }
      }
    }

    dir.delete();
  } catch {
    // best-effort
  }
}
