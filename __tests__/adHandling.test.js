jest.mock('react-native-google-mobile-ads', () => {
  return {
    __esModule: true,
    default: jest.fn(),
    MaxAdContentRating: {
      PG: 'pg',
    },
    AdsConsentStatus: {},
    AdsConsentDebugGeography: {
      EEA: 'EEA',
    },
  };
});

import { getUserConsent } from '../utils/adHandling';

describe('getUserConsent', () => {
  const mockSetRequestConfiguration = jest.fn();
  const mockInitialize = jest.fn();
  const mockAdsClient = jest.fn(() => ({
    setRequestConfiguration: mockSetRequestConfiguration,
    initialize: mockInitialize,
  }));
  const mockConsentApi = {
    requestInfoUpdate: jest.fn(),
    loadAndShowConsentFormIfRequired: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSetRequestConfiguration.mockResolvedValue(undefined);
    mockInitialize.mockResolvedValue({ adapterStatuses: 'ready' });
    mockConsentApi.requestInfoUpdate.mockResolvedValue({});
    mockConsentApi.loadAndShowConsentFormIfRequired.mockResolvedValue({ status: 'OBTAINED' });
  });

  it('configures ads, requests consent info, and returns the consent status', async () => {
    const consent = await getUserConsent({ adsClient: mockAdsClient, consentApi: mockConsentApi });

    expect(mockSetRequestConfiguration).toHaveBeenCalledWith({
      maxAdContentRating: 'pg',
      tagForChildDirectedTreatment: true,
      tagForUnderAgeOfConsent: true,
      testDeviceIdentifiers: ['EMULATOR'],
    });
    expect(mockInitialize).toHaveBeenCalledTimes(1);
    expect(mockConsentApi.requestInfoUpdate).toHaveBeenCalledWith({
      debugGeography: 'EEA',
      testDeviceIdentifiers: ['TEST-DEVICE-HASHED-ID'],
    });
    expect(mockConsentApi.loadAndShowConsentFormIfRequired).toHaveBeenCalledTimes(1);
    expect(consent).toEqual({ status: 'OBTAINED' });
  });
});