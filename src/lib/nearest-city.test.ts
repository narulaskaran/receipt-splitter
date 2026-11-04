import { nearestCity } from "./nearest-city";

describe("nearestCity", () => {
  it.each([
    ["downtown Seattle", 47.6062, -122.3321, { city: "Seattle", region: "WA", country: "US" }],
    ["Capitol Hill, Seattle", 47.6253, -122.3222, { city: "Seattle", region: "WA", country: "US" }],
    ["Ballard, Seattle", 47.6677, -122.3844, { city: "Seattle", region: "WA", country: "US" }],
    ["Bellevue", 47.6101, -122.2015, { city: "Bellevue", region: "WA", country: "US" }],
    ["Midtown Manhattan", 40.7549, -73.984, { city: "Manhattan", region: "NY", country: "US" }],
    ["Shibuya, Tokyo", 35.658, 139.7016, { city: "Tokyo", region: "", country: "JP" }],
    ["near Munich airport", 48.32, 11.66, { city: "Neufahrn bei Freising", region: "", country: "DE" }],
    ["Brooklyn", 40.678, -73.944, { city: "Brooklyn", region: "NY", country: "US" }],
    ["Mission District, San Francisco", 37.76, -122.42, { city: "San Francisco", region: "CA", country: "US" }],
  ])("finds %s", async (_label, latitude, longitude, expected) => {
    expect(await nearestCity(latitude, longitude)).toEqual(expected);
  });

  it("returns null in open ocean, far from any city", async () => {
    expect(await nearestCity(0, -30)).toBeNull();
  });

  it("works across the antimeridian", async () => {
    // Just east of the date line, near Suva, Fiji
    expect((await nearestCity(-18.14, 178.44))?.country).toBe("FJ");
    expect((await nearestCity(-18.14, -181.56))?.country).toBe("FJ");
  });
});
