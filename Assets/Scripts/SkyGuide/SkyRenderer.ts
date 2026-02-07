// SkyRenderer.ts — MeshBuilder rendering for stars and constellation lines
// Uses 2 meshes total: Points for stars, Lines for constellations

import { STARS, HIP_TO_INDEX } from './StarData';
import { CONSTELLATIONS } from './ConstellationData';
import * as Astro from './AstroMath';
import * as Engine from './SkyEngine';

// MeshBuilder instances
let starMeshBuilder: MeshBuilder | null = null;
let lineMeshBuilder: MeshBuilder | null = null;

// SceneObject references
let starMeshVisual: RenderMeshVisual | null = null;
let lineMeshVisual: RenderMeshVisual | null = null;

// Highlight state
let highlightedConstellation: string = '';

// Constellation segment tracking (for vertex indexing)
let totalLineSegments = 0;
let constellationSegmentOffsets: number[] = []; // start vertex index per constellation

/**
 * Initialize the renderer. Creates MeshBuilder meshes and binds to visuals.
 */
export function init(
  starFieldObj: SceneObject,
  constellationLinesObj: SceneObject,
  starMaterial: Material,
  lineMaterial: Material
): void {
  // --- Star Points Mesh ---
  starMeshBuilder = new MeshBuilder([
    { name: 'position', components: 3 },
    { name: 'color', components: 4 },
  ]);
  starMeshBuilder.topology = MeshTopology.Points;
  starMeshBuilder.indexType = MeshIndexType.UInt16;

  // Pre-populate star vertices
  const starVerts: number[] = [];
  const starIndices: number[] = [];
  for (let i = 0; i < STARS.length; i++) {
    // position (0,0,0) + color (1,1,1,1) — will be updated per frame
    starVerts.push(0, 0, 0, 1, 1, 1, 1);
    starIndices.push(i);
  }
  starMeshBuilder.appendVerticesInterleaved(starVerts);
  starMeshBuilder.appendIndices(starIndices);

  starMeshVisual = starFieldObj.getComponent(
    'Component.RenderMeshVisual'
  ) as RenderMeshVisual;
  if (starMeshVisual) {
    starMeshVisual.mesh = starMeshBuilder.getMesh();
    starMeshVisual.clearMaterials();
    starMeshVisual.addMaterial(starMaterial);
  }

  // --- Constellation Lines Mesh ---
  lineMeshBuilder = new MeshBuilder([
    { name: 'position', components: 3 },
    { name: 'color', components: 4 },
  ]);
  lineMeshBuilder.topology = MeshTopology.Lines;
  lineMeshBuilder.indexType = MeshIndexType.UInt16;

  // Pre-populate line vertices (2 vertices per segment)
  const lineVerts: number[] = [];
  const lineIndices: number[] = [];
  let vertIdx = 0;

  constellationSegmentOffsets = [];
  totalLineSegments = 0;

  for (const c of CONSTELLATIONS) {
    constellationSegmentOffsets.push(vertIdx);
    for (const pair of c.lines) {
      // Two vertices per line segment
      lineVerts.push(0, 0, 0, 0.3, 0.5, 0.8, 0.4); // start vertex
      lineVerts.push(0, 0, 0, 0.3, 0.5, 0.8, 0.4); // end vertex
      lineIndices.push(vertIdx, vertIdx + 1);
      vertIdx += 2;
      totalLineSegments++;
    }
  }

  lineMeshBuilder.appendVerticesInterleaved(lineVerts);
  lineMeshBuilder.appendIndices(lineIndices);

  lineMeshVisual = constellationLinesObj.getComponent(
    'Component.RenderMeshVisual'
  ) as RenderMeshVisual;
  if (lineMeshVisual) {
    lineMeshVisual.mesh = lineMeshBuilder.getMesh();
    lineMeshVisual.clearMaterials();
    lineMeshVisual.addMaterial(lineMaterial);
  }

  print('[SkyGuide] Renderer initialized: ' +
    STARS.length + ' stars, ' +
    totalLineSegments + ' line segments');
}

/**
 * Update all mesh vertices from computed star positions.
 * Call every frame.
 */
export function updateMeshes(): void {
  if (!starMeshBuilder || !lineMeshBuilder) return;

  const positions = Engine.getStarPositions();
  if (positions.length === 0) return;

  // --- Update star vertices ---
  for (let i = 0; i < positions.length; i++) {
    const sp = positions[i];
    const [r, g, b] = Astro.bvToColor(sp.bv);
    const alpha = Astro.magnitudeToAlpha(sp.mag);

    // Stars below horizon get alpha = 0 (invisible)
    const visible = sp.y >= 0 ? alpha : 0;

    starMeshBuilder.setVertexInterleaved(i, [
      sp.x, sp.y, sp.z,
      r, g, b, visible,
    ]);
  }
  starMeshBuilder.updateMesh();

  // --- Update constellation line vertices ---
  let vertIdx = 0;
  for (let ci = 0; ci < CONSTELLATIONS.length; ci++) {
    const c = CONSTELLATIONS[ci];
    const isHighlighted = c.abbr === highlightedConstellation;

    for (const pair of c.lines) {
      const idx1 = HIP_TO_INDEX.get(pair[0]);
      const idx2 = HIP_TO_INDEX.get(pair[1]);

      if (idx1 !== undefined && idx2 !== undefined) {
        const s1 = positions[idx1];
        const s2 = positions[idx2];

        // Both stars must be above horizon for line to be visible
        const bothVisible = s1.y >= 0 && s2.y >= 0;
        const alpha = bothVisible ? (isHighlighted ? 0.9 : 0.35) : 0.0;

        const cr = isHighlighted ? 0.4 : 0.3;
        const cg = isHighlighted ? 0.85 : 0.5;
        const cb = isHighlighted ? 1.0 : 0.8;

        lineMeshBuilder.setVertexInterleaved(vertIdx, [
          s1.x, s1.y, s1.z, cr, cg, cb, alpha,
        ]);
        lineMeshBuilder.setVertexInterleaved(vertIdx + 1, [
          s2.x, s2.y, s2.z, cr, cg, cb, alpha,
        ]);
      } else {
        // One or both stars missing from catalog — hide line
        lineMeshBuilder.setVertexInterleaved(vertIdx, [0, 0, 0, 0, 0, 0, 0]);
        lineMeshBuilder.setVertexInterleaved(vertIdx + 1, [0, 0, 0, 0, 0, 0, 0]);
      }
      vertIdx += 2;
    }
  }
  lineMeshBuilder.updateMesh();
}

/**
 * Set which constellation is highlighted.
 */
export function setHighlightedConstellation(abbr: string): void {
  highlightedConstellation = abbr;
}

/**
 * Get current highlighted constellation.
 */
export function getHighlightedConstellation(): string {
  return highlightedConstellation;
}
