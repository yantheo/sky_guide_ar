// AstroMath.ts — Pure astronomy math (no Lens Studio dependencies)
// Ported from astronomy-engine core transforms

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const TWO_PI = 2 * Math.PI;

/**
 * Compute Julian Date from a JS Date object (UTC).
 */
export function julianDate(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

/**
 * Greenwich Mean Sidereal Time in radians.
 * Simplified IAU formula — accurate to ~1 arcminute.
 */
export function gmst(jd: number): number {
  const t = jd - 2451545.0;
  const f = t - Math.floor(t) + 0.5;
  const theta = TWO_PI * (f + 0.7790572732640 + 0.00273781191135448 * t);
  return ((theta % TWO_PI) + TWO_PI) % TWO_PI; // normalize to [0, 2π)
}

/**
 * Local Sidereal Time in radians.
 * @param gmstRad — GMST in radians
 * @param longitudeRad — Observer longitude in radians (East positive)
 */
export function localSiderealTime(
  gmstRad: number,
  longitudeRad: number
): number {
  return ((gmstRad + longitudeRad) % TWO_PI + TWO_PI) % TWO_PI;
}

/**
 * Convert equatorial coordinates (RA, Dec) to horizontal (Alt, Az).
 * @param raRad — Right Ascension in radians
 * @param decRad — Declination in radians
 * @param lstRad — Local Sidereal Time in radians
 * @param latRad — Observer latitude in radians
 * @returns [altitudeRad, azimuthRad] — altitude above horizon, azimuth from North clockwise
 */
export function equatorialToHorizontal(
  raRad: number,
  decRad: number,
  lstRad: number,
  latRad: number
): [number, number] {
  const ha = lstRad - raRad; // Hour Angle

  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinDec = Math.sin(decRad);
  const cosDec = Math.cos(decRad);
  const cosHA = Math.cos(ha);

  const sinAlt = sinLat * sinDec + cosLat * cosDec * cosHA;
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));

  const cosAlt = Math.cos(alt);
  if (Math.abs(cosAlt) < 1e-10) {
    // Star at zenith or nadir — azimuth is undefined
    return [alt, 0];
  }

  const cosAz = (sinDec - sinLat * sinAlt) / (cosLat * cosAlt);
  let az = Math.acos(Math.max(-1, Math.min(1, cosAz)));

  if (Math.sin(ha) > 0) {
    az = TWO_PI - az;
  }

  return [alt, az];
}

/**
 * Convert altitude/azimuth to 3D position on a celestial sphere.
 *
 * Coordinate system (matches Lens Studio with north alignment):
 *   +X = East
 *   +Y = Up (zenith)
 *   -Z = North
 *
 * @param altRad — altitude in radians (positive above horizon)
 * @param azRad — azimuth in radians from North, clockwise
 * @param radius — sphere radius
 * @returns [x, y, z]
 */
export function horizontalToCartesian(
  altRad: number,
  azRad: number,
  radius: number
): [number, number, number] {
  const cosAlt = Math.cos(altRad);
  const x = radius * cosAlt * Math.sin(azRad); // East
  const y = radius * Math.sin(altRad); // Up
  const z = -radius * cosAlt * Math.cos(azRad); // -North
  return [x, y, z];
}

/**
 * Map B-V color index to approximate RGB color.
 * B-V ranges from ~-0.4 (hot blue) to ~+2.0 (cool red).
 * @returns [r, g, b, a] normalized 0–1
 */
export function bvToColor(bv: number): [number, number, number, number] {
  const t = Math.max(-0.4, Math.min(2.0, bv));
  let r: number, g: number, b: number;

  if (t < 0.0) {
    // Blue-white stars
    r = 0.6 + 0.4 * (1 + t / 0.4);
    g = 0.7 + 0.3 * (1 + t / 0.4);
    b = 1.0;
  } else if (t < 0.4) {
    // White stars
    r = 1.0;
    g = 1.0 - 0.2 * (t / 0.4);
    b = 1.0 - 0.4 * (t / 0.4);
  } else if (t < 1.0) {
    // Yellow stars
    const s = (t - 0.4) / 0.6;
    r = 1.0;
    g = 0.8 - 0.3 * s;
    b = 0.6 - 0.4 * s;
  } else {
    // Orange-red stars
    const s = (t - 1.0) / 1.0;
    r = 1.0;
    g = 0.5 - 0.3 * s;
    b = 0.2 - 0.15 * s;
  }

  return [r, g, Math.max(0, b), 1.0];
}

/**
 * Map magnitude to alpha/brightness.
 * Brighter stars (lower mag) get higher alpha.
 * Range: mag -1.5 (Sirius) → alpha 1.0, mag 5.0 → alpha 0.15
 */
export function magnitudeToAlpha(mag: number): number {
  return Math.max(0.15, 1.0 - (mag + 1.5) / 7.5);
}

/**
 * Map magnitude to point scale factor.
 * Brighter stars rendered larger.
 * Range: mag -1.5 → scale 3.0, mag 5.0 → scale 0.5
 */
export function magnitudeToScale(mag: number): number {
  return Math.max(0.5, 3.0 - (mag + 1.5) * 0.385);
}

/**
 * Angular distance between two points on the celestial sphere.
 * Uses the haversine formula for numerical stability.
 * @returns angular distance in radians
 */
export function angularDistance(
  ra1: number,
  dec1: number,
  ra2: number,
  dec2: number
): number {
  const dDec = dec2 - dec1;
  const dRA = ra2 - ra1;
  const a =
    Math.sin(dDec / 2) ** 2 +
    Math.cos(dec1) * Math.cos(dec2) * Math.sin(dRA / 2) ** 2;
  return 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}

/**
 * Angular distance in the horizontal (Alt/Az) coordinate frame.
 * @returns angular distance in radians
 */
export function angularDistanceAltAz(
  alt1: number,
  az1: number,
  alt2: number,
  az2: number
): number {
  const dAlt = alt2 - alt1;
  const dAz = az2 - az1;
  const a =
    Math.sin(dAlt / 2) ** 2 +
    Math.cos(alt1) * Math.cos(alt2) * Math.sin(dAz / 2) ** 2;
  return 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}

/**
 * Exponential smoothing for compass heading stabilization.
 * Handles the 0°/360° wraparound correctly.
 * @param current — current smoothed heading in degrees
 * @param target — new raw heading in degrees
 * @param alpha — smoothing factor (0 = no change, 1 = instant snap)
 * @returns smoothed heading in degrees
 */
export function smoothHeading(
  current: number,
  target: number,
  alpha: number
): number {
  let diff = target - current;
  // Handle wraparound
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  let result = current + alpha * diff;
  if (result < 0) result += 360;
  if (result >= 360) result -= 360;
  return result;
}
