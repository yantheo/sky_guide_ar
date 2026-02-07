// SkyEngine.ts — GPS/compass + star position computation
// Manages observer state and computes star 3D positions each frame

import { StarRecord, StarPosition3D, ObserverState } from './Types';
import { STARS, HIP_TO_INDEX } from './StarData';
import * as Astro from './AstroMath';

// Observer state
const observer: ObserverState = {
  latitude: 0,
  longitude: 0,
  lstRadians: 0,
  headingDeg: 0,
  timestamp: 0,
};

// Computed star positions in 3D
let starPositions: StarPosition3D[] = [];
let initialized = false;
let rawHeadingDeg = 0;

const SPHERE_RADIUS = 500; // units — celestial sphere radius

export function getObserver(): ObserverState {
  return observer;
}

export function getStarPositions(): StarPosition3D[] {
  return starPositions;
}

export function isInitialized(): boolean {
  return initialized;
}

export function getSphereRadius(): number {
  return SPHERE_RADIUS;
}

/**
 * Initialize location services.
 * Must be called from onAwake/onStart of the main @component.
 */
export function initLocation(scriptComponent: BaseScriptComponent): void {
  // Request GPS position
  try {
    const locationService = global.LocatedAtComponent
      ? null
      : GeoLocation.createLocationService();
    if (locationService) {
      locationService.accuracy = GeoLocationAccuracy.Navigation;

      // Subscribe to compass heading updates
      locationService.onNorthAlignedOrientationUpdate.add(
        (northQuat: quat) => {
          rawHeadingDeg = GeoLocation.getNorthAlignedHeading(northQuat);
          // Smooth heading to reduce jitter
          observer.headingDeg = Astro.smoothHeading(
            observer.headingDeg,
            rawHeadingDeg,
            0.15
          );
        }
      );

      // Poll GPS position
      const pollGPS = () => {
        locationService.getCurrentPosition(
          (pos: GeoPosition) => {
            observer.latitude = pos.latitude * (Math.PI / 180);
            observer.longitude = pos.longitude * (Math.PI / 180);
            observer.timestamp = Date.now();
            if (!initialized) {
              initialized = true;
              print('[SkyGuide] GPS lock acquired: lat=' +
                pos.latitude.toFixed(4) + ' lon=' + pos.longitude.toFixed(4));
            }
          },
          (error: string) => {
            print('[SkyGuide] GPS error: ' + error);
          }
        );
      };

      // Poll GPS every 10 seconds
      pollGPS();
      const gpsTimer = scriptComponent.createEvent('UpdateEvent');
      let gpsCooldown = 0;
      gpsTimer.bind((ev: UpdateEvent) => {
        gpsCooldown += ev.getDeltaTime();
        if (gpsCooldown >= 10.0) {
          gpsCooldown = 0;
          pollGPS();
        }
      });
    }
  } catch (e) {
    print('[SkyGuide] LocationService not available: ' + e);
    print('[SkyGuide] Using fallback location (Paris, France)');
    // Fallback for preview mode
    observer.latitude = 48.8566 * (Math.PI / 180);
    observer.longitude = 2.3522 * (Math.PI / 180);
    observer.headingDeg = 0;
    initialized = true;
  }
}

/**
 * Set observer position manually (for testing or fallback).
 */
export function setObserverLocation(
  latDeg: number,
  lonDeg: number
): void {
  observer.latitude = latDeg * (Math.PI / 180);
  observer.longitude = lonDeg * (Math.PI / 180);
  initialized = true;
}

/**
 * Recompute all star 3D positions from current observer state + time.
 * Call this every frame or every few frames.
 */
export function updateStarPositions(): void {
  if (!initialized) return;

  const now = new Date();
  const jd = Astro.julianDate(now);
  const gmstRad = Astro.gmst(jd);
  const lstRad = Astro.localSiderealTime(gmstRad, observer.longitude);
  observer.lstRadians = lstRad;

  // Allocate array on first call
  if (starPositions.length !== STARS.length) {
    starPositions = new Array(STARS.length);
    for (let i = 0; i < STARS.length; i++) {
      starPositions[i] = {
        hip: 0, x: 0, y: 0, z: 0, mag: 0, bv: 0, name: '',
      };
    }
  }

  const lat = observer.latitude;

  for (let i = 0; i < STARS.length; i++) {
    const star = STARS[i];
    const [alt, az] = Astro.equatorialToHorizontal(
      star.ra, star.dec, lstRad, lat
    );
    const [x, y, z] = Astro.horizontalToCartesian(alt, az, SPHERE_RADIUS);

    const sp = starPositions[i];
    sp.hip = star.hip;
    sp.x = x;
    sp.y = y;
    sp.z = z;
    sp.mag = star.mag;
    sp.bv = star.bv;
    sp.name = star.name;
  }
}
