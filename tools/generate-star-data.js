#!/usr/bin/env node
/**
 * generate-star-data.js
 *
 * Downloads the HYG star catalog and Stellarium constellation data,
 * then generates TypeScript data files for the Sky Guide AR app.
 *
 * Usage: node tools/generate-star-data.js
 *
 * Outputs:
 *   Assets/Scripts/SkyGuide/StarData.ts
 *   Assets/Scripts/SkyGuide/ConstellationData.ts
 */

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

const OUTPUT_DIR = path.join(
  __dirname,
  "..",
  "Assets",
  "Scripts",
  "SkyGuide"
);

// HYG v41 database CSV (GitHub raw)
const HYG_URL =
  "https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv";

// Stellarium Western sky culture index.json (new JSON format)
const CONSTELLATION_URL =
  "https://raw.githubusercontent.com/Stellarium/stellarium-skycultures/master/western/index.json";

const MAG_LIMIT = 5.0;

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
      res.on("error", reject);
    }).on("error", reject);
  });
}

/**
 * Parse a CSV line handling quoted fields.
 */
function parseCSVLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

function parseHYG(csv) {
  const lines = csv.split("\n");
  const headers = parseCSVLine(lines[0]);

  const idx = {};
  headers.forEach((h, i) => (idx[h.trim()] = i));

  console.log("  CSV columns:", headers.slice(0, 10).join(", "), "...");
  console.log("  Key columns — hip:", idx["hip"], "ra:", idx["ra"], "dec:", idx["dec"], "mag:", idx["mag"], "ci:", idx["ci"]);

  const stars = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 10) continue;

    const mag = parseFloat(cols[idx["mag"]]);
    if (isNaN(mag) || mag > MAG_LIMIT) continue;

    const hip = parseInt(cols[idx["hip"]], 10);
    if (isNaN(hip) || hip <= 0) continue;

    const raHours = parseFloat(cols[idx["ra"]]);
    const decDeg = parseFloat(cols[idx["dec"]]);
    if (isNaN(raHours) || isNaN(decDeg)) continue;

    const bv = parseFloat(cols[idx["ci"]]) || 0;
    const proper = (cols[idx["proper"]] || "").trim();
    const con = (cols[idx["con"]] || "").trim();

    stars.push({
      hip,
      ra: raHours * (Math.PI / 12),   // hours -> radians
      dec: decDeg * (Math.PI / 180),   // degrees -> radians
      mag: Math.round(mag * 100) / 100,
      bv: Math.round(bv * 100) / 100,
      name: proper,
      con,
    });
  }

  // Sort by magnitude (brightest first)
  stars.sort((a, b) => a.mag - b.mag);
  return stars;
}

/**
 * Parse new Stellarium JSON index.json format.
 * Lines are polyline chains: [[hip1, hip2, hip3], [hip4, hip5]]
 * means hip1-hip2, hip2-hip3, hip4-hip5
 * We convert to pairs: [[hip1,hip2], [hip2,hip3], [hip4,hip5]]
 */
function parseConstellationJSON(jsonText, starsByHip) {
  const data = JSON.parse(jsonText);
  const constellations = [];

  for (const entry of data.constellations || []) {
    const abbr = entry.iau || "";
    if (!abbr) continue;

    const name = (entry.common_name && entry.common_name.native) ||
                 (entry.common_name && entry.common_name.english) ||
                 abbr;

    // Convert polyline chains to pairs
    const segments = [];
    for (const chain of entry.lines || []) {
      for (let i = 0; i + 1 < chain.length; i++) {
        const h1 = chain[i];
        const h2 = chain[i + 1];
        if (h1 > 0 && h2 > 0) {
          segments.push([h1, h2]);
        }
      }
    }

    if (segments.length === 0) continue;

    // Compute centroid from member stars
    const uniqueHips = new Set();
    for (const [h1, h2] of segments) {
      uniqueHips.add(h1);
      uniqueHips.add(h2);
    }

    let sumRA = 0, sumDec = 0, count = 0;
    for (const h of uniqueHips) {
      const star = starsByHip.get(h);
      if (star) {
        sumRA += star.ra;
        sumDec += star.dec;
        count++;
      }
    }

    const centroidRA = count > 0 ? sumRA / count : 0;
    const centroidDec = count > 0 ? sumDec / count : 0;

    constellations.push({
      abbr,
      name,
      lines: segments,
      centroidRA: Math.round(centroidRA * 10000) / 10000,
      centroidDec: Math.round(centroidDec * 10000) / 10000,
    });
  }

  return constellations;
}

function generateStarDataTS(stars) {
  let out = `// StarData.ts — Auto-generated from HYG v41 database\n`;
  out += `// ${stars.length} stars with magnitude <= ${MAG_LIMIT}\n`;
  out += `// Generated: ${new Date().toISOString()}\n\n`;
  out += `import { StarRecord } from './Types';\n\n`;
  out += `// Format: [hip, ra_rad, dec_rad, mag, bv, name, constellation]\n`;
  out += `const RAW: [number, number, number, number, number, string, string][] = [\n`;

  for (const s of stars) {
    const ra = s.ra.toFixed(6);
    const dec = s.dec.toFixed(6);
    const nameStr = s.name ? JSON.stringify(s.name) : '""';
    const conStr = s.con ? JSON.stringify(s.con) : '""';
    out += `  [${s.hip},${ra},${dec},${s.mag},${s.bv},${nameStr},${conStr}],\n`;
  }

  out += `];\n\n`;
  out += `export const STARS: StarRecord[] = RAW.map(s => ({\n`;
  out += `  hip: s[0], ra: s[1], dec: s[2], mag: s[3], bv: s[4], name: s[5], con: s[6],\n`;
  out += `}));\n\n`;
  out += `export const HIP_TO_INDEX: Map<number, number> = new Map();\n`;
  out += `STARS.forEach((s, i) => HIP_TO_INDEX.set(s.hip, i));\n`;

  return out;
}

function generateConstellationDataTS(constellations) {
  let out = `// ConstellationData.ts — Auto-generated from Stellarium western sky culture\n`;
  out += `// ${constellations.length} constellations\n`;
  out += `// Generated: ${new Date().toISOString()}\n\n`;
  out += `import { ConstellationRecord } from './Types';\n\n`;
  out += `export const CONSTELLATIONS: ConstellationRecord[] = [\n`;

  for (const c of constellations) {
    out += `  {\n`;
    out += `    abbr: ${JSON.stringify(c.abbr)},\n`;
    out += `    name: ${JSON.stringify(c.name)},\n`;
    out += `    lines: [`;
    out += c.lines.map((pair) => `[${pair[0]},${pair[1]}]`).join(",");
    out += `],\n`;
    out += `    centroidRA: ${c.centroidRA},\n`;
    out += `    centroidDec: ${c.centroidDec},\n`;
    out += `  },\n`;
  }

  out += `];\n`;
  return out;
}

async function main() {
  console.log("Downloading HYG star catalog...");
  const hygCSV = await fetchUrl(HYG_URL);
  console.log(`  Downloaded ${(hygCSV.length / 1024).toFixed(0)} KB`);

  console.log("Parsing stars...");
  const stars = parseHYG(hygCSV);
  console.log(`  Found ${stars.length} stars with mag <= ${MAG_LIMIT}`);

  const starsByHip = new Map();
  for (const s of stars) {
    starsByHip.set(s.hip, s);
  }

  console.log("Downloading Stellarium constellation data...");
  const constellationJSON = await fetchUrl(CONSTELLATION_URL);
  console.log(`  Downloaded ${(constellationJSON.length / 1024).toFixed(0)} KB`);

  console.log("Parsing constellations...");
  const constellations = parseConstellationJSON(constellationJSON, starsByHip);
  console.log(`  Found ${constellations.length} constellations`);

  // Count how many constellation line endpoints are in our star catalog
  let missingHips = 0, totalHips = 0;
  for (const c of constellations) {
    for (const [h1, h2] of c.lines) {
      totalHips += 2;
      if (!starsByHip.has(h1)) missingHips++;
      if (!starsByHip.has(h2)) missingHips++;
    }
  }
  console.log(`  Constellation star coverage: ${totalHips - missingHips}/${totalHips} endpoints found in catalog`);
  if (missingHips > 0) {
    console.log(`  (${missingHips} missing stars are dimmer than mag ${MAG_LIMIT} — lines to them will be hidden)`);
  }

  console.log("Generating StarData.ts...");
  const starTS = generateStarDataTS(stars);
  fs.writeFileSync(path.join(OUTPUT_DIR, "StarData.ts"), starTS);
  console.log(`  Written ${(starTS.length / 1024).toFixed(0)} KB`);

  console.log("Generating ConstellationData.ts...");
  const constTS = generateConstellationDataTS(constellations);
  fs.writeFileSync(path.join(OUTPUT_DIR, "ConstellationData.ts"), constTS);
  console.log(`  Written ${(constTS.length / 1024).toFixed(0)} KB`);

  console.log("\nDone! Files generated in Assets/Scripts/SkyGuide/");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
