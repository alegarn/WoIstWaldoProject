import {
  SUPPORTED_IMAGE_TYPES,
  LEGACY_DECODE_ONLY_TYPES,
  extensionForContentType,
  sniffImageType,
  decodeImagePayload,
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

    it('supported + legacy decode types mirror Storage::UploadConstraints DECODE_CONTENT_TYPES', () => {
      expect([...SUPPORTED_IMAGE_TYPES, ...LEGACY_DECODE_ONLY_TYPES]).toEqual(
        serverConstraints.decodeContentTypes
      );
    });

    it('gif is decode-only: never uploadable, still readable', () => {
      expect(SUPPORTED_IMAGE_TYPES).not.toContain('image/gif');
      expect(LEGACY_DECODE_ONLY_TYPES).toEqual(['image/gif']);
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
    });

    it('normalizes parameters, case and whitespace before mapping', () => {
      expect(extensionForContentType('image/png; charset=binary')).toBe('png');
      expect(extensionForContentType('IMAGE/WEBP')).toBe('webp');
      expect(extensionForContentType('  image/jpeg  ')).toBe('jpeg');
    });

    it('returns null for unknown or missing content types', () => {
      expect(extensionForContentType('text/html')).toBeNull();
      expect(extensionForContentType('image/tiff')).toBeNull();
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

  describe('decodeImagePayload', () => {
    it('encodes raw sniffed bytes to base64 and derives the extension from the sniffed type', () => {
      const decoded = decodeImagePayload(PNG_BYTES, undefined);

      expect(decoded.extension).toBe('png');
      expect(decoded.base64).toHaveLength(Math.ceil((PNG_BYTES.length / 3) * 4));
    });

    it('prefers a valid response Content-Type over the sniffed type for the extension', () => {
      const decoded = decodeImagePayload(PNG_BYTES, 'image/webp');

      expect(decoded.extension).toBe('webp');
    });

    it('falls through to the sniffed type when the Content-Type is not an image type', () => {
      const decoded = decodeImagePayload(JPEG_BYTES, 'text/plain');

      expect(decoded.extension).toBe('jpeg');
    });

    it('accepts ArrayBuffer payloads (axios arraybuffer responses)', () => {
      const decoded = decodeImagePayload(JPEG_BYTES.slice().buffer, 'image/jpeg');

      expect(decoded.extension).toBe('jpeg');
    });

    it('decodes raw sniffed gif bytes with a gif Content-Type to a gif file', () => {
      const decoded = decodeImagePayload(GIF89A_BYTES.slice().buffer, 'image/gif');

      expect(decoded.extension).toBe('gif');
      expect(decoded.base64).toHaveLength(Math.ceil((GIF89A_BYTES.length / 3) * 4));
    });

    it('C8: decodes legacy ASCII "data:image/" ArrayBuffer payloads byte-level', () => {
      const bytes = legacyDataUrlBytes('data:image/png;base64,AAEC');

      const decoded = decodeImagePayload(bytes, 'text/plain');

      expect(decoded.base64).toBe('AAEC');
      expect(decoded.extension).toBe('png');
    });

    it('C5: gif stays decodable through the legacy branch', () => {
      const bytes = legacyDataUrlBytes('data:image/gif;base64,R0lGODlh');

      const decoded = decodeImagePayload(bytes, undefined);

      expect(decoded.base64).toBe('R0lGODlh');
      expect(decoded.extension).toBe('gif');
    });

    it('prefers a valid Content-Type header extension for legacy payloads', () => {
      const bytes = legacyDataUrlBytes('data:image/png;base64,AAEC');

      const decoded = decodeImagePayload(bytes, 'image/webp');

      expect(decoded.extension).toBe('webp');
    });

    it('decodes legacy string data-URL responses', () => {
      const decoded = decodeImagePayload('data:image/jpeg;base64,/9j/4AAQ', undefined);

      expect(decoded.base64).toBe('/9j/4AAQ');
      expect(decoded.extension).toBe('jpeg');
    });

    it('rejects legacy payloads whose type is neither supported nor legacy-decodable', () => {
      expect(decodeImagePayload('data:image/tiff;base64,AAEC', undefined)).toBeNull();
      expect(decodeImagePayload(legacyDataUrlBytes('data:image/bmp;base64,AAEC'), undefined)).toBeNull();
    });

    it('rejects payloads that neither sniff nor carry the legacy prefix', () => {
      expect(decodeImagePayload(new Uint8Array([0x00, 0x01, 0x02]), 'image/png')).toBeNull();
      expect(decodeImagePayload('not-base64', undefined)).toBeNull();
      expect(decodeImagePayload('', undefined)).toBeNull();
      expect(decodeImagePayload(null, undefined)).toBeNull();
      expect(decodeImagePayload(new ArrayBuffer(0), undefined)).toBeNull();
    });
  });
});
