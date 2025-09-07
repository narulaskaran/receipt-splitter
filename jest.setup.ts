import "@testing-library/jest-dom";

// Avoid opening windows during tests
Object.defineProperty(window, "open", {
  writable: true,
  configurable: true,
  value: jest.fn(() => null),
});

// Stub navigator.share if not present
if (!("share" in navigator)) {
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
