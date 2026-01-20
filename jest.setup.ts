import "@testing-library/jest-dom";

// =============================================================================
// Window API Mocks
// =============================================================================

// Avoid opening windows during tests
Object.defineProperty(window, "open", {
  writable: true,
  configurable: true,
  value: jest.fn(() => null),
});

// Mock window.matchMedia for components that use media queries
Object.defineProperty(window, "matchMedia", {
  writable: true,
  configurable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock window.alert
window.alert = jest.fn();

// =============================================================================
// Navigator API Mocks
// =============================================================================

// Mock navigator.share
Object.defineProperty(navigator, "share", {
  writable: true,
  configurable: true,
  value: jest.fn().mockResolvedValue(undefined),
});

// Mock navigator.clipboard
Object.defineProperty(navigator, "clipboard", {
  writable: true,
  configurable: true,
  value: {
    writeText: jest.fn().mockResolvedValue(undefined),
    readText: jest.fn().mockResolvedValue(""),
  },
});

// =============================================================================
// Crypto API Mock
// =============================================================================

// Mock crypto.randomUUID for consistent test IDs
Object.defineProperty(global, "crypto", {
  writable: true,
  configurable: true,
  value: {
    randomUUID: jest.fn(() => "00000000-0000-4000-8000-000000000000"),
    getRandomValues: jest.fn((arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
  },
});

// =============================================================================
// Storage API Mock
// =============================================================================

// Create a mock localStorage that persists within each test but resets between tests
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

Object.defineProperty(window, "localStorage", {
  writable: true,
  configurable: true,
  value: localStorageMock,
});

// =============================================================================
// Fetch API Mock (base setup - tests can override as needed)
// =============================================================================

global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: jest.fn().mockResolvedValue({}),
  text: jest.fn().mockResolvedValue(""),
  status: 200,
  statusText: "OK",
});

// =============================================================================
// Console Suppression (keep tests quiet)
// =============================================================================

const originalError = console.error;
const originalWarn = console.warn;
const originalLog = console.log;

beforeAll(() => {
  // Suppress console output during tests (can be overridden per-test if needed)
  console.error = jest.fn();
  console.warn = jest.fn();
  console.log = jest.fn();
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
  console.log = originalLog;
});

// =============================================================================
// Global Test Cleanup
// =============================================================================

beforeEach(() => {
  // Clear all mock call history between tests
  jest.clearAllMocks();

  // Reset localStorage between tests
  localStorageMock.clear();
});

// Note: Individual tests that modify navigator.share should restore it in their own afterEach
