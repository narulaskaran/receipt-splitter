export interface NearestCity {
  city: string;
  /** US state code (e.g. "WA"); empty outside the US */
  region: string;
  /** ISO 3166-1 alpha-2 country code */
  country: string;
}

// A point this far from every known city is open country or sea, where a city
// name would mislead more than help
const MAX_DISTANCE_KM = 100;

const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/**
 * The closest city (over 15,000 people, GeoNames data; see
 * scripts/build-city-data.js) to a point, by distance to the city centre.
 * Returns null when none is within MAX_DISTANCE_KM.
 *
 * The ~34,000-row table is loaded on first use, so requests that never need a
 * place name don't pay for it.
 */
export async function nearestCity(latitude: number, longitude: number): Promise<NearestCity | null> {
  // [name, latitude, longitude, country, US state]; JSON imports are typed loosely
  const { default: cities } = (await import("./data/cities.json")) as unknown as {
    default: [string, number, number, string, string][];
  };

  let best: (typeof cities)[number] | null = null;
  let bestDistance = MAX_DISTANCE_KM;
  for (const row of cities) {
    const distance = distanceKm(latitude, longitude, row[1], row[2]);
    if (distance < bestDistance) {
      best = row;
      bestDistance = distance;
    }
  }
  return best ? { city: best[0], region: best[4], country: best[3] } : null;
}
