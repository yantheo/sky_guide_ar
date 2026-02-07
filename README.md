# Sky Guide AR for Snap Spectacles

An augmented reality stargazing app for **Snap Spectacles (2024)** built with **Lens Studio 5.15** (TypeScript). Look at the real sky through AR glasses and see stars, constellation lines, and labels overlaid on your view.

## Features

- **1,625 stars** rendered in real-time from the HYG stellar database (magnitude <= 5.0)
- **88 constellations** with line figures from Stellarium Western sky culture
- **Gaze highlight** — look at a constellation for 0.5s to highlight it
- **Hand interaction** — right pinch to select and show info, left pinch to dismiss
- **Compass alignment** — stars align to the real sky via GPS + compass heading
- **Offline-first** — all data embedded in the app, no internet required
- **2 draw calls** — optimized MeshBuilder rendering for Spectacles battery life

## Files Created — Summary

| File | Lines | Purpose |
|---|---|---|
| `Assets/Scripts/SkyGuide/Types.ts` | 37 | Shared interfaces (StarRecord, ObserverState, etc.) |
| `Assets/Scripts/SkyGuide/AstroMath.ts` | 216 | Pure astronomy math (RA/Dec to Alt/Az, B-V color mapping) |
| `Assets/Scripts/SkyGuide/StarData.ts` | 1,641 | 1,625 stars from HYG v41 database (auto-generated) |
| `Assets/Scripts/SkyGuide/ConstellationData.ts` | 624 | 88 constellations from Stellarium (auto-generated) |
| `Assets/Scripts/SkyGuide/SkyEngine.ts` | 161 | GPS/compass integration + star position computation |
| `Assets/Scripts/SkyGuide/SkyRenderer.ts` | 183 | MeshBuilder rendering (1 Points mesh + 1 Lines mesh) |
| `Assets/Scripts/SkyGuide/GazeAndHandController.ts` | 172 | Gaze detection + pinch selection (angular distance, no physics) |
| `Assets/Scripts/SkyGuide/InfoPanel.ts` | 125 | Constellation info billboard (Text3D) |
| `Assets/Scripts/SkyGuide/SkyGuideMain.ts` | 147 | Entry point @component — wires everything together |
| `tools/generate-star-data.js` | 230 | Node.js script to regenerate StarData.ts + ConstellationData.ts |

## Architecture

```
SkyGuideMain.ts (@component — attach to SkyRoot)
    ├── SkyEngine.ts        GPS/compass + star position computation
    │   ├── AstroMath.ts    Pure trig: RA/Dec → Alt/Az → 3D coordinates
    │   ├── StarData.ts     1,625 embedded stars from HYG v41
    │   └── ConstellationData.ts   88 constellations from Stellarium
    ├── SkyRenderer.ts      MeshBuilder: Points mesh + Lines mesh (2 draw calls)
    ├── GazeAndHandController.ts   Angular distance gaze test + GestureModule pinch
    └── InfoPanel.ts        Text billboard for constellation info
```

## Prerequisites

- **Lens Studio 5.15.x** — Download the Spectacles-specific build from [ar.snap.com/spectacles](https://ar.snap.com/spectacles) (NOT the regular Lens Studio)
- **Snap Spectacles (2024)** — 5th generation developer kit
- **Node.js** — Only needed if you want to regenerate star/constellation data

## Lens Studio Setup Guide

### Step 1 — Create the Lens Studio Project

1. Open **Lens Studio 5.15**
2. Select **Spectacles > Base Template** from the Home Page
3. Save the project

### Step 2 — Import the Scripts

1. In the **Asset Browser** panel (bottom), right-click > **Import Files**
2. Navigate to `Assets/Scripts/SkyGuide/`
3. Select **all 9 .ts files** and import them

### Step 3 — Create Materials

**Material 1: StarPointMaterial**
1. In Asset Browser: **+** > **Material** > **Unlit**
2. Rename to `StarPointMaterial`
3. Enable **Vertex Color** in the material settings
4. Set **Blend Mode** to **Normal**

**Material 2: ConstellationLineMaterial**
1. In Asset Browser: **+** > **Material** > **Unlit**
2. Rename to `ConstellationLineMaterial`
3. Enable **Vertex Color**
4. Set **Blend Mode** to **Normal**

### Step 4 — Build the Scene Hierarchy

Create these objects in the **Scene Hierarchy** panel:

```
Camera                         (already exists — has DeviceTracking: World)
SpectaclesInteractionKit       (already exists from Base Template)
SkyRoot                        ← New Empty Object
  ├── StarField                ← New Empty Object (child of SkyRoot)
  └── ConstellationLines       ← New Empty Object (child of SkyRoot)
InfoPanelRoot                  ← New Empty Object
  └── InfoText                 ← New Text object (child of InfoPanelRoot)
```

**Setup details:**

| Object | How to Create | Components to Add |
|---|---|---|
| **SkyRoot** | Right-click root > Add New > Empty Object | (script added in Step 5) |
| **StarField** | Right-click SkyRoot > Add New > Empty Object | Add **Render Mesh Visual**, assign `StarPointMaterial` |
| **ConstellationLines** | Right-click SkyRoot > Add New > Empty Object | Add **Render Mesh Visual**, assign `ConstellationLineMaterial` |
| **InfoPanelRoot** | Right-click root > Add New > Empty Object | — |
| **InfoText** | Right-click InfoPanelRoot > Add New > Text | Set font size ~24, color white |

### Step 5 — Attach the Main Script

1. Select **SkyRoot** in the Scene Hierarchy
2. Inspector > **Add Component** > **Script**
3. Assign `SkyGuideMain.ts`
4. Wire up the **@input fields**:

| Input Field | Assign To |
|---|---|
| Star Field Object | `StarField` |
| Constellation Lines Object | `ConstellationLines` |
| Info Panel Root | `InfoPanelRoot` |
| Info Text Object | `InfoText` |
| Star Material | `StarPointMaterial` |
| Line Material | `ConstellationLineMaterial` |
| Camera | `Camera` |

### Step 6 — Test in Preview

1. Set **Device Type** to **Spectacles** (bottom of Preview panel)
2. Click the **Interactive Preview** button (top-left of Preview)
3. Use **WASD** to move, **mouse** to look around
4. Stars and constellation lines should appear on the celestial sphere
5. Looking at a constellation for 0.5s highlights it in cyan

> **Note:** GPS/compass are not available in preview — the app falls back to Paris, France as the observer location. Real sky alignment requires deploying to Spectacles hardware.

## Regenerating Star Data

If you want to update the star catalog or constellation data:

```bash
node tools/generate-star-data.js
```

This downloads the latest data from:
- **Stars:** [HYG Database v41](https://github.com/astronexus/HYG-Database) (hygdata_v41.csv)
- **Constellations:** [Stellarium Sky Cultures](https://github.com/Stellarium/stellarium-skycultures) (western/index.json)

## Performance

Targeting 60 FPS on Spectacles hardware:

| Operation | Cost | Frequency |
|---|---|---|
| Star position computation (1,625 stars) | ~0.5ms | Every 2 frames |
| Vertex updates (~3,000 vertices) | ~0.5ms | Every frame |
| Gaze hit testing (88 constellations) | ~0.1ms | Every frame |
| GPU render (2 draw calls) | ~0.5ms | Every frame |
| **Total** | **~1.6ms** | **Leaves ~15ms headroom** |

## License

Star data: [HYG Database](https://github.com/astronexus/HYG-Database) — CC BY-SA 2.5
Constellation data: [Stellarium](https://github.com/Stellarium/stellarium-skycultures) — GPL v2
