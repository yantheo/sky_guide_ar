// Types.ts — Shared interfaces for Sky Guide AR

export interface StarRecord {
  hip: number;          // Hipparcos ID (for constellation line matching)
  ra: number;           // Right Ascension in radians
  dec: number;          // Declination in radians
  mag: number;          // Apparent visual magnitude
  bv: number;           // B-V color index (for star color)
  name: string;         // Common name or empty string
  con: string;          // Constellation abbreviation
}

export interface ConstellationRecord {
  abbr: string;         // IAU 3-letter abbreviation (e.g. "ORI")
  name: string;         // Full name (e.g. "Orion")
  lines: number[][];    // Array of [hip1, hip2] line segment pairs
  centroidRA: number;   // Centroid RA in radians (precomputed)
  centroidDec: number;  // Centroid Dec in radians (precomputed)
}

export interface StarPosition3D {
  hip: number;
  x: number;
  y: number;
  z: number;
  mag: number;
  bv: number;
  name: string;
}

export interface ObserverState {
  latitude: number;     // radians
  longitude: number;    // radians
  lstRadians: number;   // Local Sidereal Time in radians
  headingDeg: number;   // compass heading in degrees (0=North, clockwise)
  timestamp: number;    // ms since epoch
}
