// Run tests west of UTC so date-only strings parsed as UTC midnight
// (e.g. new Date("2026-10-05")) show up as the previous day and fail.
// Set here, before workers spawn, because test files see a sandboxed process.env.
process.env.TZ = "America/New_York";

/** @type {import('jest').Config} */
const config = {
  testEnvironment: "jsdom",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
    "^next/image$": "<rootDir>/__mocks__/next-image.js",
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testPathIgnorePatterns: ["/node_modules/", "/.next/", "/e2e/", "babel.config.test.js"],
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],
  transform: {
    "^.+\\.(ts|tsx)$": ["babel-jest", { configFile: "./babel.config.test.js" }],
  },
  transformIgnorePatterns: ["/node_modules/(?!(^@testing-library|^next)/)"],
};

module.exports = config;
