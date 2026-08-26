process.env.EXPO_OS = 'ios';
process.env.EXPO_PUBLIC_APP_BACKEND_URL = process.env.EXPO_PUBLIC_APP_BACKEND_URL || 'https://backend.example/';

// Default test locale 'en' for every suite: initializes i18next and the
// react-i18next global instance so existing English assertions stay valid.
require('./i18n');

globalThis.fetch;

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    getAllKeys: jest.fn().mockResolvedValue([]),
    multiRemove: jest.fn(),
  },
}));

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    LOG_LEVEL: { DEBUG: 0, VERBOSE: 1, INFO: 2, WARN: 3, ERROR: 4 },
    configure: jest.fn(),
    logOut: jest.fn(),
    setLogLevel: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(),
    removeCustomerInfoUpdateListener: jest.fn(),
    getOfferings: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
    getCustomerInfo: jest.fn(),
  },
}));
