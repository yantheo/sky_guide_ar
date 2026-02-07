// InfoPanel.ts — Star/constellation info display
// Shows a billboard Text3D panel in front of the user's view

import { CONSTELLATIONS } from './ConstellationData';
import { STARS, HIP_TO_INDEX } from './StarData';

let infoPanelRoot: SceneObject | null = null;
let infoTextComponent: Text | null = null;
let camera: SceneObject | null = null;
let isVisible = false;

const PANEL_DISTANCE = 3.0; // units in front of camera

/**
 * Initialize the info panel.
 */
export function init(
  panelRoot: SceneObject,
  textObj: SceneObject,
  cameraObj: SceneObject
): void {
  infoPanelRoot = panelRoot;
  camera = cameraObj;

  // Try to get Text component (Text3D or Text)
  infoTextComponent = textObj.getComponent('Component.Text') as Text;
  if (!infoTextComponent) {
    print('[SkyGuide] Warning: No Text component found on info text object');
  }

  hide();
}

/**
 * Show info for a constellation.
 */
export function showConstellationInfo(abbr: string, name: string): void {
  if (!infoPanelRoot || !infoTextComponent || !camera) return;

  const c = CONSTELLATIONS.find((con) => con.abbr === abbr);
  if (!c) return;

  // Collect notable star names from this constellation
  const uniqueHips = new Set<number>();
  for (const pair of c.lines) {
    uniqueHips.add(pair[0]);
    uniqueHips.add(pair[1]);
  }

  const starNames: string[] = [];
  for (const hip of uniqueHips) {
    const idx = HIP_TO_INDEX.get(hip);
    if (idx !== undefined && STARS[idx].name) {
      starNames.push(STARS[idx].name);
    }
  }

  let text = name + ' (' + abbr + ')\n';
  text += uniqueHips.size + ' stars\n';
  if (starNames.length > 0) {
    text += 'Notable: ' + starNames.slice(0, 4).join(', ');
  }

  infoTextComponent.text = text;
  positionInFrontOfCamera();
  infoPanelRoot.enabled = true;
  isVisible = true;
}

/**
 * Hide the info panel.
 */
export function hide(): void {
  if (infoPanelRoot) {
    infoPanelRoot.enabled = false;
  }
  isVisible = false;
}

/**
 * Whether the panel is currently visible.
 */
export function getIsVisible(): boolean {
  return isVisible;
}

/**
 * Reposition the panel in front of the camera.
 */
function positionInFrontOfCamera(): void {
  if (!camera || !infoPanelRoot) return;

  const camTransform = camera.getTransform();
  const camPos = camTransform.getWorldPosition();
  const camForward = camTransform.forward;

  // Place panel PANEL_DISTANCE in front of the camera
  // Lens Studio camera forward is already the look direction
  const panelPos = new vec3(
    camPos.x + camForward.x * PANEL_DISTANCE,
    camPos.y + camForward.y * PANEL_DISTANCE + 0.5, // slightly above center
    camPos.z + camForward.z * PANEL_DISTANCE
  );

  infoPanelRoot.getTransform().setWorldPosition(panelPos);

  // Make panel face the camera (billboard)
  const toCamera = new vec3(
    camPos.x - panelPos.x,
    camPos.y - panelPos.y,
    camPos.z - panelPos.z
  );
  const rotation = quat.lookAt(toCamera, vec3.up());
  infoPanelRoot.getTransform().setWorldRotation(rotation);
}

/**
 * Update panel position to follow the camera.
 * Call from frame update if panel is visible.
 */
export function updatePosition(): void {
  if (isVisible) {
    positionInFrontOfCamera();
  }
}
