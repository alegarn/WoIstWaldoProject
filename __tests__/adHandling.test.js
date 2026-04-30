const setRequestConfiguration = jest.fn();
const initialize = jest.fn();
const requestInfoUpdate = jest.fn();
const loadAndShowConsentFormIfRequired = jest.fn();

jest.mock('react-native-google-mobile-ads', () => {
  const mobileAds = jest.fn(() => ({
    setRequestConfiguration,
    initialize,
  }));

  return {
    __esModule: true,
    default: mobileAds,
    MaxAdContentRating: {
      PG: 'pg',
    },
    AdsConsent: {
      requestInfoUpdate,
      loadAndShowConsentFormIfRequired,
    },
    AdsConsentStatus: {},
    AdsConsentDebugGeography: {
      EEA: 'EEA',
    },
  };
});

import { getUserConsent } from '../utils/adHandling';

describe('getUserConsent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setRequestConfiguration.mockResolvedValue(undefined);
    initialize.mockResolvedValue({ adapterStatuses: 'ready' });
    requestInfoUpdate.mockResolvedValue({});
    loadAndShowConsentFormIfRequired.mockResolvedValue({ status: 'OBTAINED' });
  });

  it('configures ads, requests consent info, and returns the consent status', async () => {
    const consent = await getUserConsent();

    expect(setRequestConfiguration).toHaveBeenCalledWith({
      maxAdContentRating: 'pg',
      tagForChildDirectedTreatment: true,
      tagForUnderAgeOfConsent: true,
      testDeviceIdentifiers: ['EMULATOR'],
    });
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(requestInfoUpdate).toHaveBeenCalledWith({
      debugGeography: 'EEA',
      testDeviceIdentifiers: ['TEST-DEVICE-HASHED-ID'],
    });
    expect(loadAndShowConsentFormIfRequired).toHaveBeenCalledTimes(1);
    expect(consent).toEqual({ status: 'OBTAINED' });
  });
});