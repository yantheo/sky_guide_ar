# CLAUDE.md — Sky Guide AR for Snap Spectacles

## Project Overview

Sky Guide AR is an augmented reality stargazing app for **Snap Spectacles (2024, 5th gen)**, built with **Lens Studio 5.15** (TypeScript). The user looks at the real sky through the AR glasses and sees stars, constellation lines, and labels overlaid on their view.

### Core Features (v1)
- **Star identification** — 1,625 stars (magnitude <= 5.0) rendered as points on a celestial sphere
- **Constellation lines** — 88 Western constellations from Stellarium data
- **Gaze highlight** — Looking at a constellation for 0.5s highlights it in cyan
- **Hand interaction** — Right pinch = select/info, Left pinch = dismiss
- **Compass alignment** — Stars align to the real sky via GPS + compass heading
- **Offline-first** — All data embedded, no network required

### Target Platform
- Snap Spectacles 2024 (5th gen) — 46-degree FOV, 45min battery, dual Snapdragon
- Lens Studio 5.15.x (Spectacles-specific build from ar.snap.com/spectacles)
- TypeScript scripting with Lens Studio APIs

## Architecture

```
SkyGuideMain.ts (@component entry point)
    ├── SkyEngine.ts      — GPS/compass + star position computation
    │   ├── AstroMath.ts  — Pure trig: RA/Dec → Alt/Az → 3D (no LS deps)
    │   ├── StarData.ts   — 1,625 stars from HYG v41 database (embedded)
    │   └── ConstellationData.ts — 88 constellations from Stellarium (embedded)
    ├── SkyRenderer.ts    — MeshBuilder: 1 Points mesh + 1 Lines mesh (2 draw calls)
    ├── GazeAndHandController.ts — Angular distance hit test (O(88), no physics)
    └── InfoPanel.ts      — Text billboard for constellation info
```

### Key Design Decisions
1. **2 MeshBuilder meshes total** — Not 1,625 SceneObjects. Points topology for stars, Lines topology for constellations. Only 2 GPU draw calls.
2. **Angular distance hit testing** — No physics colliders. Gaze direction compared to 88 constellation centroids per frame via haversine formula.
3. **Embedded data** — Lens Studio has no runtime file loading. Star catalog + constellation lines are TypeScript constants.
4. **Ported astronomy math** — astronomy-engine npm can't run in LS sandbox. Core RA/Dec→Alt/Az is ~120 lines of pure trig in AstroMath.ts.
5. **Compass smoothing** — Exponential low-pass filter on heading to reduce jitter (alpha=0.15).

## File Structure

```
AI_AR_Project/
├── CLAUDE.md                              # This file
├── Assets/Scripts/SkyGuide/
│   ├── Types.ts                           # Shared interfaces
│   ├── AstroMath.ts                       # Astronomy math (pure, no LS deps)
│   ├── StarData.ts                        # Auto-generated: 1,625 stars from HYG v41
│   ├── ConstellationData.ts               # Auto-generated: 88 constellations from Stellarium
│   ├── SkyEngine.ts                       # Observer state, GPS, compass, position computation
│   ├── SkyRenderer.ts                     # MeshBuilder rendering (Points + Lines)
│   ├── GazeAndHandController.ts           # Gaze detection + GestureModule pinch events
│   ├── InfoPanel.ts                       # Text billboard for star/constellation info
│   └── SkyGuideMain.ts                    # @component entry point (attach to SkyRoot)
├── tools/
│   └── generate-star-data.js              # Node.js script to regenerate StarData.ts + ConstellationData.ts
```

## Commands

```bash
# Regenerate star catalog + constellation data from online sources
node tools/generate-star-data.js

# Data sources:
# - Stars: https://github.com/astronexus/HYG-Database (hyg/CURRENT/hygdata_v41.csv)
# - Constellations: https://github.com/Stellarium/stellarium-skycultures (western/index.json)
```

## Lens Studio Scene Hierarchy

```
Camera                         (DeviceTracking: World — from Base Template)
SpectaclesInteractionKit       (from Base Template)
SkyRoot                        (SkyGuideMain.ts attached here)
  ├── StarField                (RenderMeshVisual + StarPointMaterial)
  └── ConstellationLines       (RenderMeshVisual + ConstellationLineMaterial)
InfoPanelRoot
  └── InfoText                 (Text component)
```

### Materials Required
- **StarPointMaterial** — Unlit, Vertex Color enabled, Blend: Normal
- **ConstellationLineMaterial** — Unlit, Vertex Color enabled, Blend: Normal

### @input Bindings on SkyGuideMain
| Input | Object |
|---|---|
| starFieldObject | StarField |
| constellationLinesObject | ConstellationLines |
| infoPanelRoot | InfoPanelRoot |
| infoTextObject | InfoText |
| starMaterial | StarPointMaterial |
| lineMaterial | ConstellationLineMaterial |
| camera | Camera |

## Lens Studio APIs Used

| API | Usage |
|---|---|
| `MeshBuilder` | Procedural star points + constellation lines |
| `GeoLocation.createLocationService()` | GPS position |
| `LocationService.onNorthAlignedOrientationUpdate` | Compass heading |
| `GeoLocation.getNorthAlignedHeading()` | Heading from quaternion |
| `DeviceTracking` (World mode) | 6DOF head tracking |
| `GestureModule` (via require) | Pinch detection |
| `RenderMeshVisual` | Mesh display |
| `Text` component | Info panel text |

## Coordinate System

- **Celestial sphere**: radius 500 units, centered on user
- **Axes**: +X = East, +Y = Up (zenith), -Z = North
- **SkyRoot rotation**: rotated around Y by compass heading to align with geographic North
- **Star positions**: computed from (RA, Dec) → (Alt, Az) → (x, y, z) using observer's GPS + Local Sidereal Time

## Performance Budget (60 FPS target)

- Star position computation: ~0.5ms every 2 frames (1,625 stars, ~16K trig ops)
- Vertex updates: ~0.5ms/frame (3,000 vertices via setVertexInterleaved)
- Gaze hit testing: ~0.1ms/frame (88 angular distance comparisons)
- GPU: 2 draw calls, ~3K vertices
- **Total: ~1.6ms/frame** (leaves ~15ms headroom)

## Known Limitations & Future Work

### Current Limitations
- Stars render as single-pixel points (MeshTopology.Points) — may be hard to see
- GPS/compass not available in Lens Studio preview — falls back to Paris, France
- ~50 constellation line endpoints reference stars dimmer than mag 5.0 (hidden)
- No planet rendering yet (only fixed stars)

### Planned Enhancements
- **Billboarded star quads** — Replace point sprites with small quads for variable star sizes
- **Planet tracking** — Add solar system objects using astronomy-engine ephemeris math
- **Voice commands** — "What constellation is that?" / "Show me Orion"
- **Constellation art** — Overlay mythology illustrations on constellations
- **Time travel** — Scrub time to see sky at different hours/dates
- **Calibration UI** — "Point at Polaris to calibrate" for compass offset correction
- **Multi-star selection** — Point at individual stars (not just constellations)

## Gotchas

- **Lens Studio != Node.js** — No npm, no require() for external packages, no fs. Only `require('LensStudio:...')` for built-in modules.
- **StarData.ts and ConstellationData.ts are auto-generated** — Don't edit by hand. Run `node tools/generate-star-data.js` to regenerate.
- **Camera forward in Lens Studio** — `transform.forward` returns the camera's look direction. DeviceTracking updates it automatically.
- **quat.fromEulerAngles()** — Takes (pitch, yaw, roll) in radians. We use (0, headingRad, 0) for Y-axis rotation.
- **Vertex Color must be enabled on materials** — Otherwise MeshBuilder color attributes are ignored and everything renders white.
- **Lens Studio version** — Must use 5.15.x from ar.snap.com/spectacles (NOT the regular Lens Studio from ar.snap.com/download).
- **GestureModule may not be available in preview** — Wrapped in try/catch with fallback.
