import axios from 'axios';
import type { AxiosResponse } from 'axios';
import { File, Directory, Paths } from 'expo-file-system';
import { decodeImagePayload } from '../../utils/imageFormats';
import type { DecodedImagePayload } from '../../utils/imageFormats';
import {
  usesBackendStorage,
  setStorageDownloadHeaders,
  getBackendHeaders,
} from '../../utils/imagesRequests';

export type HomeBackgroundSlot = 'hide' | 'find' | 'ranking';

export const SLOTS: readonly HomeBackgroundSlot[] = ['hide', 'find', 'ranking'];

const HOME_BG_DIR = 'private-home-bg';
const DELETE_EXTENSIONS = ['png', 'jpeg', 'webp', 'jpg', 'heic', 'heif', 'gif'];

function groupDir(groupId: string | number | null | undefined) {
  return new Directory(Paths.cache, HOME_BG_DIR, String(groupId));
}

function localHomeBgFile(groupId: string | number | null | undefined, slot: string | null | undefined, imageId: string | number | null | undefined, ext: string) {
  return new File(
    Paths.cache,
    HOME_BG_DIR,
    String(groupId),
    `${slot}-${imageId}.${ext}`
  );
}

function localHomeBgUri(groupId: string | number | null | undefined, slot: string | null | undefined, imageId: string | number | null | undefined, ext: string) {
  return localHomeBgFile(groupId, slot, imageId, ext).uri;
}

function localHomeBgExists(groupId: string | number | null | undefined, slot: string | null | undefined, imageId: string | number | null | undefined, ext: string) {
  try {
    return !!localHomeBgFile(groupId, slot, imageId, ext).exists;
  } catch {
    return false;
  }
}

function ensureGroupDir(groupId: string | number | null | undefined) {
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

function normalizeExt(ext: string | null | undefined): string | null {
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
}: {
  context?: unknown;
  groupId?: string | number | null;
  slot?: string;
  imageId?: string | number | null;
  fileExtension?: string | null;
  url?: string | null;
}): Promise<string | null> {
  if (!imageId || !SLOTS.includes(slot as HomeBackgroundSlot)) return null;

  const ext = normalizeExt(fileExtension);

  if (ext && localHomeBgExists(groupId, slot, imageId, ext)) {
    return localHomeBgUri(groupId, slot, imageId, ext);
  }

  if (!url || typeof url !== 'string') return null;

  ensureGroupDir(groupId);

  const isBackend = usesBackendStorage(url);
  let response: AxiosResponse | undefined;
  let decoded: DecodedImagePayload | null = null;
  try {
    if (isBackend) {
      const { token } = await getBackendHeaders(context);
      response = await axios.get(url, {
        headers: setStorageDownloadHeaders(token),
        responseType: 'arraybuffer',
        timeout: 15000,
      });
    } else {
      response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 15000,
      });
    }
    decoded = decodeImagePayload(response?.data, response?.headers?.['content-type'] as string | undefined);
  } catch (err) {
    return isBackend ? null : url;
  }

  if (!decoded) return isBackend ? null : url;

  const finalExt = ext || decoded.extension;

  try {
    const file = localHomeBgFile(groupId, slot, imageId, finalExt);
    file.write(decoded.base64, { encoding: 'base64' });
    return file.uri;
  } catch (err) {
    return isBackend ? null : url;
  }
}

export function deleteHomeBackgroundFile(groupId: string | number | null | undefined, slot: string | null | undefined, imageId: string | number | null | undefined) {
  try {
    for (const ext of DELETE_EXTENSIONS) {
      const file = localHomeBgFile(groupId, slot, imageId, ext);
      if (file?.exists) file.delete();
    }
  } catch {
    // best-effort
  }
}

export function clearGroupHomeBackgrounds(groupId: string | number | null | undefined) {
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
