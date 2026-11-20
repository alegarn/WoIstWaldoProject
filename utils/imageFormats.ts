export const SUPPORTED_IMAGE_TYPES = [
  'image/webp',
  'image/jpeg',
  'image/jpg',
  'image/heic',
  'image/heif',
  'image/png',
] as const;

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpeg',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/png': 'png',
  'image/gif': 'gif',
};

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
