import { homeHash, parseMobileHash, splitHash } from "@/mobile/routes";

describe("mobile hash routes", () => {
  it("builds home and split links", () => {
    expect(homeHash()).toBe("#/");
    expect(splitHash()).toBe("#/split");
    expect(splitHash("?names=A&amounts=1")).toBe("#/split?names=A&amounts=1");
    expect(splitHash("names=A")).toBe("#/split?names=A");
  });

  it("parses home and split hashes", () => {
    expect(parseMobileHash("")).toEqual({ name: "home" });
    expect(parseMobileHash("#/")).toEqual({ name: "home" });
    expect(parseMobileHash("#/people")).toEqual({ name: "home" });

    const split = parseMobileHash("#/split?names=Ada&amounts=4.00");
    expect(split.name).toBe("split");
    if (split.name === "split") {
      expect(split.searchParams.get("names")).toBe("Ada");
      expect(split.searchParams.get("amounts")).toBe("4.00");
    }
  });
});
