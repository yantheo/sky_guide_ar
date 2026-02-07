// SkyGuideMain.ts — Entry point @component for Sky Guide AR
// Attach this script to the SkyRoot SceneObject in Lens Studio

// Request location permission
require('LensStudio:RawLocationModule');

import * as Engine from './SkyEngine';
import * as Renderer from './SkyRenderer';
import * as Interaction from './GazeAndHandController';
import * as Panel from './InfoPanel';

@component
export class SkyGuideMain extends BaseScriptComponent {

  // --- Scene references (wire these in Lens Studio Inspector) ---

  @input('SceneObject')
  @ui.label('Star Field Object')
  starFieldObject: SceneObject;

  @input('SceneObject')
  @ui.label('Constellation Lines Object')
  constellationLinesObject: SceneObject;

  @input('SceneObject')
  @ui.label('Info Panel Root')
  infoPanelRoot: SceneObject;

  @input('SceneObject')
  @ui.label('Info Text Object')
  infoTextObject: SceneObject;

  @input('Asset.Material')
  @ui.label('Star Material')
  starMaterial: Material;

  @input('Asset.Material')
  @ui.label('Line Material')
  lineMaterial: Material;

  @input('SceneObject')
  @ui.label('Camera')
  camera: SceneObject;

  // --- Settings ---

  @ui.separator
  @ui.label('Performance')

  @input('int')
  @ui.label('Position Update Interval (frames)')
  positionUpdateInterval: number = 2;

  // --- Private state ---

  private frameCount: number = 0;

  onAwake(): void {
    this.createEvent('OnStartEvent').bind(() => this.onStart());
  }

  onStart(): void {
    print('[SkyGuide] Starting Sky Guide AR...');

    // Initialize location/compass
    Engine.initLocation(this);

    // Initialize renderer with scene objects and materials
    Renderer.init(
      this.starFieldObject,
      this.constellationLinesObject,
      this.starMaterial,
      this.lineMaterial
    );

    // Initialize info panel
    Panel.init(
      this.infoPanelRoot,
      this.infoTextObject,
      this.camera
    );

    // Initialize interaction controller
    Interaction.init(
      this.camera,
      (abbr: string, name: string) => {
        // On constellation selected (pinch)
        print('[SkyGuide] Selected: ' + name);
        Panel.showConstellationInfo(abbr, name);
      },
      () => {
        // On constellation deselected
        Panel.hide();
      },
      this
    );

    // Main frame update loop
    this.createEvent('UpdateEvent').bind((ev: UpdateEvent) => {
      this.onUpdate(ev);
    });

    print('[SkyGuide] Initialized. Waiting for GPS lock...');
  }

  private onUpdate(ev: UpdateEvent): void {
    this.frameCount++;
    const dt = ev.getDeltaTime();

    // Throttle star position computation (stars barely move between frames)
    if (this.frameCount % this.positionUpdateInterval === 0) {
      Engine.updateStarPositions();
    }

    // Update mesh rendering every frame (for highlight changes)
    Renderer.updateMeshes();

    // Update gaze detection
    Interaction.updateGaze(dt);

    // Update info panel position if visible
    Panel.updatePosition();

    // Align SkyRoot to compass north
    this.alignToNorth();
  }

  /**
   * Rotate the SkyRoot SceneObject so that the celestial coordinate
   * system aligns with real-world compass heading.
   *
   * The SkyEngine computes star positions with North at -Z.
   * DeviceTracking (World mode) keeps the camera in a fixed reference frame.
   * We rotate SkyRoot by the compass heading to align stars with the real sky.
   */
  private alignToNorth(): void {
    if (!Engine.isInitialized()) return;

    const heading = Engine.getObserver().headingDeg;
    const headingRad = heading * (Math.PI / 180);

    // Rotate SkyRoot around Y axis by heading
    // This aligns the -Z axis of SkyRoot with geographic North
    const rotation = quat.fromEulerAngles(0, headingRad, 0);
    this.getSceneObject().getTransform().setLocalRotation(rotation);
  }
}
