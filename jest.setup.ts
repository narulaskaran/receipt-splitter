import "@testing-library/jest-dom";

// Only setup window-related mocks if in jsdom environment
if (typeof window !== "undefined") {
  // Avoid opening windows during tests
  Object.defineProperty(window, "open", {
    writable: true,
    configurable: true,
    value: jest.fn(() => null),
  });
}

// Only setup navigator-related mocks if in jsdom environment
if (typeof navigator !== "undefined" && !("share" in navigator)) {
  // Stub navigator.share if not present
  Object.defineProperty(navigator, "share", {
    writable: true,
    configurable: true,
    value: jest.fn().mockResolvedValue(undefined),
  });
}

// Silence noisy console warnings/errors during tests
const originalError = console.error;
const originalWarn = console.warn;
beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});
afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});
