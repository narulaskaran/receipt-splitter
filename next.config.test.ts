/**
 * @jest-environment node
 */
import config from "./next.config";

// The package is ESM-only and only wraps the config for the build.
jest.mock("@serwist/turbopack", () => ({
  withSerwist: (nextConfig: unknown) => nextConfig,
}));

describe("next.config", () => {
  it("makes browsers revalidate the service worker script on every load", async () => {
    const rules = (await config.headers?.()) ?? [];
    const rule = rules.find((r) => r.source === "/serwist/:path*");

    expect(rule?.headers).toContainEqual({
      key: "Cache-Control",
      value: "public, max-age=0, must-revalidate",
    });
  });
});
