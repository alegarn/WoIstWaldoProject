process.env.EXPO_OS = 'ios';
process.env.EXPO_PUBLIC_APP_BACKEND_URL = process.env.EXPO_PUBLIC_APP_BACKEND_URL || 'https://backend.example/';

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
    getOfferings: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
    getCustomerInfo: jest.fn(),
  },
  Purchases: {
    configure: jest.fn(),
    logOut: jest.fn(),
  },
}));
