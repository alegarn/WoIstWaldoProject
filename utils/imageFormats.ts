import { fromByteArray } from 'base64-js';

export const SUPPORTED_IMAGE_TYPES = [
  'image/webp',
  'image/jpeg',
  'image/jpg',
  'image/heic',
  'image/heif',
  'image/png',
] as const;

export const LEGACY_DECODE_ONLY_TYPES = ['image/gif'] as const;

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpeg',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/png': 'png',
  'image/gif': 'gif',
};

const DECODABLE_CONTENT_TYPES = new Set<string>([
  ...SUPPORTED_IMAGE_TYPES,
  ...LEGACY_DECODE_ONLY_TYPES,
]);

const LEGACY_PREFIX_BYTES = [0x64, 0x61, 0x74, 0x61, 0x3a, 0x69, 0x6d, 0x61, 0x67, 0x65];
const LEGACY_BASE64_SEPARATOR = ';base64,';

export function extensionForContentType(contentType: string): string | null {
  if (typeof contentType !== 'string') {
    return null;
  }

  const normalized = contentType.split(';')[0].trim().toLowerCase();
  return EXTENSION_BY_CONTENT_TYPE[normalized] ?? null;
}

function equalsAscii(bytes: Uint8Array, offset: number, text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    if (bytes[offset + i] !== text.charCodeAt(i)) {
      return false;
    }
  }
  return true;
}

function startsWithLegacyDataUrlPrefix(bytes: Uint8Array): boolean {
  if (bytes.length < LEGACY_PREFIX_BYTES.length) {
    return false;
  }
  return LEGACY_PREFIX_BYTES.every((byte, index) => bytes[index] === byte);
}

function asciiSlice(bytes: Uint8Array, start: number, end: number): string {
  let out = '';
  const CHUNK_SIZE = 0x8000;
  for (let i = start; i < end; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, end)) as unknown as number[];
    out += String.fromCharCode.apply(null, chunk);
  }
  return out;
}

export function sniffImageType(bytes: Uint8Array): string | null {
  if (!bytes || bytes.length < 12) {
    return null;
  }

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  if (equalsAscii(bytes, 0, 'RIFF') && equalsAscii(bytes, 8, 'WEBP')) {
    return 'image/webp';
  }

  if (equalsAscii(bytes, 0, 'GIF87a') || equalsAscii(bytes, 0, 'GIF89a')) {
    return 'image/gif';
  }

  if (equalsAscii(bytes, 4, 'ftyp')) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (brand === 'heic') {
      return 'image/heic';
    }
    if (brand === 'heif' || brand === 'mif1' || brand === 'msf1') {
      return 'image/heif';
    }
  }

  return null;
}

export type DecodedImagePayload = {
  base64: string;
  extension: string;
};

function bytesFromResponseData(data: unknown): Uint8Array | null {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (typeof ArrayBuffer !== 'undefined' && data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (ArrayBuffer.isView(data)) {
    const view = data as ArrayBufferView;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }
  return null;
}

function decodeLegacyDataUrlText(text: string, headerExtension: string | null): DecodedImagePayload | null {
  const match = text.match(/^data:(image\/[\w.+-]+);base64,([\s\S]*)$/);
  if (!match) {
    return null;
  }

  const contentType = match[1];
  if (!DECODABLE_CONTENT_TYPES.has(contentType)) {
    return null;
  }

  return {
    base64: match[2],
    extension: headerExtension ?? EXTENSION_BY_CONTENT_TYPE[contentType],
  };
}

function decodeLegacyDataUrlBytes(bytes: Uint8Array, headerExtension: string | null): DecodedImagePayload | null {
  const separatorIndex = bytes.indexOf(LEGACY_BASE64_SEPARATOR.charCodeAt(0));
  if (separatorIndex < 0 || !equalsAscii(bytes, separatorIndex, LEGACY_BASE64_SEPARATOR)) {
    return null;
  }

  const subType = asciiSlice(bytes, LEGACY_PREFIX_BYTES.length + 1, separatorIndex);
  const contentType = `image/${subType}`;
  if (!DECODABLE_CONTENT_TYPES.has(contentType)) {
    return null;
  }

  return {
    base64: asciiSlice(bytes, separatorIndex + LEGACY_BASE64_SEPARATOR.length, bytes.length),
    extension: headerExtension ?? EXTENSION_BY_CONTENT_TYPE[contentType],
  };
}

export function decodeImagePayload(data: unknown, contentType?: string | null): DecodedImagePayload | null {
  const headerExtension = contentType ? extensionForContentType(contentType) : null;

  if (typeof data === 'string') {
    return decodeLegacyDataUrlText(data, headerExtension);
  }

  const bytes = bytesFromResponseData(data);
  if (!bytes || bytes.length === 0) {
    return null;
  }

  const sniffedType = sniffImageType(bytes);
  if (sniffedType !== null) {
    return {
      base64: fromByteArray(bytes),
      extension: headerExtension ?? EXTENSION_BY_CONTENT_TYPE[sniffedType],
    };
  }

  if (startsWithLegacyDataUrlPrefix(bytes)) {
    return decodeLegacyDataUrlBytes(bytes, headerExtension);
  }

  return null;
}
