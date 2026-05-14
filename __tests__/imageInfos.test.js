jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn(),
}));

import { handleImageType, isTypeValid } from '../utils/imageInfos';

describe('imageInfos', () => {
  it('extracts a valid extension from Expo asset URIs with query strings', () => {
    expect(
      handleImageType('http://192.168.0.161:8081/assets/farm_pict_320.jpg?platform=android&hash=abc123')
    ).toBe('jpg');
    expect(isTypeValid(handleImageType('asset:///fixture.PNG#cache-bust'))).toBe(true);
  });

  it('returns an empty extension when the URI has no file suffix', () => {
    expect(handleImageType('content://media/external/images/media/42')).toBe('');
    expect(isTypeValid(handleImageType('content://media/external/images/media/42'))).toBe(false);
  });
});