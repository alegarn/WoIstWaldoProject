import { File, Directory, Paths } from 'expo-file-system';
import {
  usesBackendStorage,
  setStorageDownloadHeaders,
  getBackendHeaders,
} from '../../utils/imagesRequests';
import { downloadImageFile, normalizeFileExtension } from '../../utils/imageDownloader';

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

  const ext = normalizeFileExtension(fileExtension);

  if (ext && localHomeBgExists(groupId, slot, imageId, ext)) {
    return localHomeBgUri(groupId, slot, imageId, ext);
  }

  if (!url || typeof url !== 'string') return null;

  ensureGroupDir(groupId);

  const isBackend = usesBackendStorage(url);
  try {
    const headers = isBackend
      ? setStorageDownloadHeaders((await getBackendHeaders(context)).token)
      : undefined;
    const { fileUri } = await downloadImageFile({
      url,
      directory: groupDir(groupId),
      name: `${slot}-${imageId}`,
      preferredExtension: ext,
      headers,
    });
    return fileUri;
  } catch {
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
