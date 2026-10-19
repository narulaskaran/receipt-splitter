import { OFFLINE_FALLBACKS } from "./offline-fallbacks";

type Param = Parameters<(typeof OFFLINE_FALLBACKS)[number]["matcher"]>[0];

// What the worker would serve for a failed request: the first matching entry.
function fallbackFor(url: string, destination: RequestDestination) {
  const param = {
    request: { url: `https://example.com${url}`, destination },
  } as unknown as Param;
  return OFFLINE_FALLBACKS.find((entry) => entry.matcher(param))?.url;
}

describe("OFFLINE_FALLBACKS", () => {
  it("serves the /split shell for shared split links, whatever the query", () => {
    expect(fallbackFor("/split?names=A&amounts=100&total=100", "document")).toBe(
      "/split"
    );
    expect(fallbackFor("/split", "document")).toBe("/split");
  });

  it("serves the offline page for any other page", () => {
    expect(fallbackFor("/nope", "document")).toBe("/offline");
    expect(fallbackFor("/split/extra", "document")).toBe("/offline");
  });

  it("does not replace non-page requests", () => {
    expect(fallbackFor("/split?x=1", "script")).toBeUndefined();
    expect(fallbackFor("/api/parse-receipt", "")).toBeUndefined();
  });

  it("lists the /split entry before the generic one", () => {
    expect(OFFLINE_FALLBACKS.map((entry) => entry.url)).toEqual([
      "/split",
      "/offline",
    ]);
  });
});
