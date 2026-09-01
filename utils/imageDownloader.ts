import { File } from 'expo-file-system';
import type { Directory } from 'expo-file-system';
import { downloadAsync } from 'expo-file-system/legacy';
import type { FileSystemDownloadResult } from 'expo-file-system/legacy';
import { extensionForContentType } from './imageFormats';

const DEFAULT_IMAGE_EXTENSION = 'jpg';
const TEMPORARY_DOWNLOAD_EXTENSION = 'download';

/**
 * Typed download failure carrying the HTTP status when the server answered.
 * `status` is undefined (and `networkFailure` true) when no HTTP response was
 * received at all (timeout, connection refused) — the transport-class failure
 * semantics `isNetworkClassFailure` used to derive from axios errors.
 */
export class ImageDownloadError extends Error {
  readonly status?: number;
  readonly networkFailure: boolean;

  constructor(status: number | undefined, message: string) {
    super(message);
    this.name = 'ImageDownloadError';
    this.status = status;
    this.networkFailure = status == null;
  }
}

export type DownloadedImageFile = {
  fileUri: string;
  extension: string;
};

export function normalizeFileExtension(extension: string | null | undefined): string | null {
  if (typeof extension !== 'string' || extension.length === 0) {
    return null;
  }
  const normalized = extension.replace(/^\./, '').toLowerCase();
  return /^[a-z0-9]{2,5}$/.test(normalized) ? normalized : null;
}

export function extensionFromUrlPath(url: string): string | null {
  if (typeof url !== 'string' || url.length === 0) {
    return null;
  }
  const withoutQuery = url.split('?')[0].split('#')[0];
  const lastSegment = withoutQuery.slice(withoutQuery.lastIndexOf('/') + 1);
  const dotIndex = lastSegment.lastIndexOf('.');
  if (dotIndex < 0) {
    return null;
  }
  return normalizeFileExtension(lastSegment.slice(dotIndex + 1));
}

function contentTypeFromHeaders(headers: Record<string, string> | undefined): string | null {
  if (!headers) {
    return null;
  }
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === 'content-type') {
      return value;
    }
  }
  return null;
}

function isSuccessStatus(status: number): boolean {
  return status >= 200 && status <= 299;
}

function deleteFileQuietly(file: File): void {
  try {
    file.delete();
  } catch {
    // best-effort cleanup
  }
}

function errorMessage(error: unknown): string {
  return (error as { message?: string })?.message ?? 'Network request failed';
}

/**
 * Download image bytes from `url` straight to disk via the native
 * expo-file-system transport (legacy `downloadAsync`: OkHttp/NSURLSession
 * stream the body into the destination file — bytes never cross the JS
 * thread, and no base64 encoding happens anywhere).
 *
 * Streams into `<name>.download` inside `directory`, then renames to
 * `<name>.<ext>` once the extension is known. Extension precedence:
 * caller-provided `preferredExtension` (URL-path/file-hint conventions of
 * the thumbnail/background caches), then the response `Content-Type` header
 * (`extensionForContentType`), then the URL path extension, then a sane
 * default. Throws `ImageDownloadError` on non-2xx (status preserved) and on
 * transport failures (status undefined, `networkFailure` true).
 */
export async function downloadImageFile({ url, directory, name, preferredExtension, headers }: {
  url: string;
  directory: Directory;
  name: string;
  preferredExtension?: string | null;
  headers?: Record<string, string> | null;
}): Promise<DownloadedImageFile> {
  directory.create({ idempotent: true, intermediates: true });

  const tempFile = new File(directory, `${name}.${TEMPORARY_DOWNLOAD_EXTENSION}`);
  let result: FileSystemDownloadResult;
  try {
    result = await downloadAsync(url, tempFile.uri, headers ? { headers } : undefined);
  } catch (error) {
    deleteFileQuietly(tempFile);
    throw new ImageDownloadError(undefined, errorMessage(error));
  }

  if (!isSuccessStatus(result.status)) {
    deleteFileQuietly(tempFile);
    throw new ImageDownloadError(result.status, `Image download failed with status ${result.status}`);
  }

  const contentType = contentTypeFromHeaders(result.headers);
  const extension = normalizeFileExtension(preferredExtension)
    ?? extensionForContentType(contentType ?? '')
    ?? extensionFromUrlPath(url)
    ?? DEFAULT_IMAGE_EXTENSION;

  const destination = new File(directory, `${name}.${extension}`);
  tempFile.moveSync(destination, { overwrite: true });

  return { fileUri: destination.uri, extension };
}
