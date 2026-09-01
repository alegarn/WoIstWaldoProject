import {
  SUPPORTED_IMAGE_TYPES,
  extensionForContentType,
  sniffImageType,
} from '../utils/imageFormats';
import serverConstraints from './fixtures/serverUploadConstraints.json';

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const WEBP_BYTES = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
const GIF89A_BYTES = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x0a, 0x00, 0x0a, 0x00, 0x80, 0x00,
]);
const GIF87A_BYTES = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0x0a, 0x00, 0x0a, 0x00, 0x80, 0x00,
]);
const HEIC_BYTES = new Uint8Array([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63,
]);
const HEIF_MIF1_BYTES = new Uint8Array([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x69, 0x66, 0x31,
]);
const HEIF_MSF1_BYTES = new Uint8Array([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x73, 0x66, 0x31,
]);
const HEIF_BRAND_BYTES = new Uint8Array([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x66,
]);

const legacyDataUrlBytes = (text) => {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    bytes[i] = text.charCodeAt(i) & 0xff;
  }
  return bytes;
};

describe('utils/imageFormats', () => {
  describe('server allowlist sync', () => {
    it('SUPPORTED_IMAGE_TYPES mirrors Storage::UploadConstraints UPLOAD_CONTENT_TYPES', () => {
      expect([...SUPPORTED_IMAGE_TYPES]).toEqual(serverConstraints.uploadContentTypes);
    });

    it('gif is never uploadable (server keeps its own decode-side gif shim)', () => {
      expect(SUPPORTED_IMAGE_TYPES).not.toContain('image/gif');
    });
  });

  describe('extensionForContentType', () => {
    it('maps every supported type to a file extension', () => {
      expect(extensionForContentType('image/webp')).toBe('webp');
      expect(extensionForContentType('image/jpeg')).toBe('jpeg');
      expect(extensionForContentType('image/jpg')).toBe('jpeg');
      expect(extensionForContentType('image/heic')).toBe('heic');
      expect(extensionForContentType('image/heif')).toBe('heif');
      expect(extensionForContentType('image/png')).toBe('png');
      expect(extensionForContentType('image/gif')).toBe('gif');
    });

    it('normalizes parameters, case and whitespace before mapping', () => {
      expect(extensionForContentType('image/png; charset=binary')).toBe('png');
      expect(extensionForContentType('IMAGE/WEBP')).toBe('webp');
      expect(extensionForContentType('  image/jpeg  ')).toBe('jpeg');
    });

    it('returns null for unknown or missing content types', () => {
      expect(extensionForContentType('text/html')).toBeNull();
      expect(extensionForContentType('image/tiff')).toBeNull();
      expect(extensionForContentType('binary/octet-stream')).toBeNull();
      expect(extensionForContentType('')).toBeNull();
      expect(extensionForContentType(undefined)).toBeNull();
      expect(extensionForContentType(null)).toBeNull();
    });
  });

  describe('sniffImageType', () => {
    it.each([
      ['image/jpeg', JPEG_BYTES],
      ['image/png', PNG_BYTES],
      ['image/webp', WEBP_BYTES],
      ['image/gif', GIF89A_BYTES],
      ['image/gif', GIF87A_BYTES],
      ['image/heic', HEIC_BYTES],
      ['image/heif', HEIF_MIF1_BYTES],
      ['image/heif', HEIF_MSF1_BYTES],
      ['image/heif', HEIF_BRAND_BYTES],
    ])('sniffs %s from magic bytes', (expected, bytes) => {
      expect(sniffImageType(bytes)).toBe(expected);
    });

    it('rejects truncated magics', () => {
      expect(sniffImageType(new Uint8Array([0xff, 0xd8]))).toBeNull();
      expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]))).toBeNull();
      expect(sniffImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00]))).toBeNull();
      expect(sniffImageType(legacyDataUrlBytes('GIF8'))).toBeNull();
      expect(sniffImageType(new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79]))).toBeNull();
      expect(sniffImageType(new Uint8Array())).toBeNull();
    });

    it('rejects non-image bytes', () => {
      expect(sniffImageType(new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b]))).toBeNull();
      expect(
        sniffImageType(legacyDataUrlBytes('data:image/png;base64,AAAA'))
      ).toBeNull();
    });

    it('rejects RIFF containers that are not WebP', () => {
      const wav = legacyDataUrlBytes('RIFF') ;
      const bytes = new Uint8Array([...wav, 0x00, 0x00, 0x00, 0x00, ...legacyDataUrlBytes('WAVE')]);
      expect(sniffImageType(bytes)).toBeNull();
    });

    it('rejects ftyp boxes with non-image brands', () => {
      const mp4 = new Uint8Array([
        0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
      ]);
      expect(sniffImageType(mp4)).toBeNull();
    });
  });
});
