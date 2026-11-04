#!/usr/bin/env node
/**
 * Builds src/lib/data/cities.json, the place-name table behind photo locations
 * (src/lib/nearest-city.ts), from GeoNames' "cities15000" dump: every city
 * with more than 15,000 people.
 *
 * Usage:
 *   curl -O https://download.geonames.org/export/dump/cities15000.zip
 *   (unzip it, then)
 *   node scripts/build-city-data.js path/to/cities15000.txt
 *
 * Neighbourhood rows (feature code PPLX) are dropped.
 *
 * Output rows: [name, latitude, longitude, ISO country code, US state or ""].
 * Coordinates are rounded to 2 decimals (~1 km), which is all a city centre
 * needs. GeoNames data is CC BY 4.0 (https://www.geonames.org/).
 */
const fs = require("fs");
const path = require("path");

const input = process.argv[2];
if (!input) {
  console.error("Usage: node scripts/build-city-data.js <cities15000.txt>");
  process.exit(1);
}

const round = (value) => Math.round(Number(value) * 100) / 100;

const rows = fs
  .readFileSync(input, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => line.split("\t"))
  // PPLX is a section of a city (Hell's Kitchen, Ballard): the city is the useful name
  .filter((cols) => cols[7] !== "PPLX")
  .map((cols) => {
    // 1 name, 4 latitude, 5 longitude, 8 country code, 10 admin1 code
    const country = cols[8];
    return [cols[1], round(cols[4]), round(cols[5]), country, country === "US" ? cols[10] : ""];
  })
  .sort((a, b) => a[3].localeCompare(b[3]) || a[0].localeCompare(b[0]));

const output = path.join(__dirname, "..", "src", "lib", "data", "cities.json");
fs.writeFileSync(output, JSON.stringify(rows) + "\n");
console.log(`Wrote ${rows.length} cities to ${path.relative(process.cwd(), output)}`);
