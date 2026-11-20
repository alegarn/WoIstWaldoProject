module.exports = {
  __esModule: true,
  TestIds: {
    INTERSTITIAL: '/mock/test/interstitial',
  },
  useInterstitialAd: jest.fn(() => ({
    isLoaded: true,
    isOpened: false,
    isClosed: false,
    isShowing: false,
    load: jest.fn(),
    show: jest.fn(),
  })),
  MobileAds: jest.fn(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    setRequestConfiguration: jest.fn().mockResolvedValue(undefined),
  })),
};
