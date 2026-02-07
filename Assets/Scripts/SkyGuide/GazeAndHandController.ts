// GazeAndHandController.ts — Gaze detection + hand pointing + pinch selection
// Uses angular distance comparison against constellation centroids (no physics raycasts)

import { CONSTELLATIONS } from './ConstellationData';
import * as Astro from './AstroMath';
import * as Engine from './SkyEngine';
import * as Renderer from './SkyRenderer';

// State
let camera: SceneObject | null = null;
let onConstellationSelected: ((abbr: string, name: string) => void) | null = null;
let onConstellationDeselected: (() => void) | null = null;

const GAZE_THRESHOLD_RAD = 8.0 * (Math.PI / 180); // 8 degrees
let currentGazeConstellation: string = '';
let gazeHoldTime = 0;
const GAZE_HOLD_DELAY = 0.5; // seconds before gaze triggers highlight

/**
 * Initialize the interaction controller.
 */
export function init(
  cameraObj: SceneObject,
  onSelected: (abbr: string, name: string) => void,
  onDeselected: () => void,
  scriptComponent: BaseScriptComponent
): void {
  camera = cameraObj;
  onConstellationSelected = onSelected;
  onConstellationDeselected = onDeselected;

  // Set up pinch gestures via GestureModule
  try {
    const gestureModule = require('LensStudio:GestureModule') as GestureModule;

    // Right hand pinch = select / show info
    gestureModule
      .getPinchDownEvent(GestureModule.HandType.Right)
      .add(() => {
        if (currentGazeConstellation !== '') {
          const c = CONSTELLATIONS.find(
            (con) => con.abbr === currentGazeConstellation
          );
          if (c && onConstellationSelected) {
            onConstellationSelected(c.abbr, c.name);
          }
        }
      });

    // Left hand pinch = dismiss info
    gestureModule
      .getPinchDownEvent(GestureModule.HandType.Left)
      .add(() => {
        if (onConstellationDeselected) {
          onConstellationDeselected();
        }
      });

    print('[SkyGuide] GestureModule initialized');
  } catch (e) {
    print('[SkyGuide] GestureModule not available (preview mode): ' + e);
  }
}

/**
 * Update gaze detection. Call every frame.
 * Checks camera forward direction against constellation centroids.
 */
export function updateGaze(deltaTime: number): void {
  if (!camera || !Engine.isInitialized()) return;

  const cameraTransform = camera.getTransform();

  // Lens Studio camera forward is -Z in local space.
  // getTransform().forward returns the forward direction vector.
  const camForward = cameraTransform.forward;

  // Camera forward in world space
  // In Lens Studio, forward is the -Z axis direction
  const fx = camForward.x;
  const fy = camForward.y;
  const fz = camForward.z;

  // Convert camera forward vector to altitude/azimuth
  // In our coordinate system: +X = East, +Y = Up, -Z = North
  // But the SkyRoot is rotated by compass heading, so we need
  // to account for that rotation.
  //
  // The camera is a child of the scene (tracked by DeviceTracking),
  // and the SkyRoot is rotated by heading. So the camera's world-space
  // forward needs to be un-rotated by the heading to get the
  // sky-relative direction.
  const heading = Engine.getObserver().headingDeg;
  const headingRad = heading * (Math.PI / 180);

  // Un-rotate camera direction by heading (inverse Y rotation)
  const cosH = Math.cos(-headingRad);
  const sinH = Math.sin(-headingRad);
  const skyX = fx * cosH - fz * sinH;
  const skyZ = fx * sinH + fz * cosH;
  const skyY = fy;

  // Convert to gaze altitude and azimuth
  const len = Math.sqrt(skyX * skyX + skyY * skyY + skyZ * skyZ);
  if (len < 0.001) return;

  const gazeAlt = Math.asin(skyY / len);
  // Azimuth: atan2(East, -North) = atan2(skyX, -skyZ)
  let gazeAz = Math.atan2(skyX, -skyZ);
  if (gazeAz < 0) gazeAz += 2 * Math.PI;

  // Only check constellations above horizon
  if (gazeAlt < -5 * (Math.PI / 180)) {
    clearGaze();
    return;
  }

  const obs = Engine.getObserver();
  let closestAbbr = '';
  let closestDist = GAZE_THRESHOLD_RAD;

  for (const c of CONSTELLATIONS) {
    // Convert constellation centroid to horizontal coordinates
    const [cAlt, cAz] = Astro.equatorialToHorizontal(
      c.centroidRA, c.centroidDec, obs.lstRadians, obs.latitude
    );

    // Skip constellations below horizon
    if (cAlt < 0) continue;

    // Angular distance between gaze and centroid
    const dist = Astro.angularDistanceAltAz(gazeAlt, gazeAz, cAlt, cAz);

    if (dist < closestDist) {
      closestDist = dist;
      closestAbbr = c.abbr;
    }
  }

  // Update highlight state
  if (closestAbbr !== currentGazeConstellation) {
    if (closestAbbr === '') {
      clearGaze();
    } else {
      currentGazeConstellation = closestAbbr;
      gazeHoldTime = 0;
    }
  } else if (closestAbbr !== '') {
    gazeHoldTime += deltaTime;
    if (gazeHoldTime >= GAZE_HOLD_DELAY) {
      Renderer.setHighlightedConstellation(closestAbbr);
    }
  }
}

function clearGaze(): void {
  if (currentGazeConstellation !== '') {
    currentGazeConstellation = '';
    gazeHoldTime = 0;
    Renderer.setHighlightedConstellation('');
    if (onConstellationDeselected) {
      onConstellationDeselected();
    }
  }
}

/**
 * Get the currently gazed-at constellation abbreviation.
 */
export function getCurrentGazeConstellation(): string {
  return currentGazeConstellation;
}
