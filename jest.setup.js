/* eslint-env jest */
const { NativeModules } = require('react-native');

// Mock en memoria de AsyncStorage (JavaScript puro)
const mockAsyncStorageStore = new Map();

const mockAsyncStorage = {
  setItem: jest.fn(async (key, value) => {
    mockAsyncStorageStore.set(key, value);
    return null;
  }),
  getItem: jest.fn(async (key) => {
    return mockAsyncStorageStore.has(key) ? mockAsyncStorageStore.get(key) : null;
  }),
  removeItem: jest.fn(async (key) => {
    mockAsyncStorageStore.delete(key);
    return null;
  }),
  clear: jest.fn(async () => {
    mockAsyncStorageStore.clear();
    return null;
  }),
  getAllKeys: jest.fn(async () => {
    return Array.from(mockAsyncStorageStore.keys());
  }),
};

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

// Mock de NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn().mockResolvedValue({
    type: 'wifi',
    isConnected: true,
    isInternetReachable: true,
    details: {
      isConnectionExpensive: false,
      ssid: 'Test_WiFi',
      strength: 95,
      ipAddress: '192.168.1.100',
    },
  }),
  addEventListener: jest.fn(() => jest.fn()),
  useNetInfo: jest.fn(() => ({
    type: 'wifi',
    isConnected: true,
    isInternetReachable: true,
    details: null,
  })),
}));

// Mock de Geolocation Service
jest.mock('react-native-geolocation-service', () => ({
  getCurrentPosition: jest.fn((success) =>
    success({
      coords: {
        latitude: -32.4812,
        longitude: -58.2341,
        altitude: 20,
        accuracy: 10,
        heading: 0,
        speed: 0,
      },
      timestamp: Date.now(),
    })
  ),
  requestAuthorization: jest.fn().mockResolvedValue('granted'),
}));

// Mock de WebView
jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    WebView: (props) => React.createElement(View, { testID: 'mock-webview', ...props }),
  };
});

// Mock de TCP Socket
jest.mock('react-native-tcp-socket', () => ({
  createConnection: jest.fn(),
}));

// Mock de Módulos Nativos Propios (TelephonyModule y NotificationModule)
NativeModules.TelephonyModule = {
  getCellularDetails: jest.fn().mockResolvedValue({
    operatorName: 'Personal',
    networkType: '4G LTE',
    signalDbm: -88,
    signalLevel: 3,
    cellId: 123456,
    tac: 789,
    hasLocationPermission: true,
    hasPhoneStatePermission: true,
  }),
};

NativeModules.NotificationModule = {
  postNotification: jest.fn().mockResolvedValue(1001),
  checkNotificationPermission: jest.fn().mockResolvedValue(true),
};
