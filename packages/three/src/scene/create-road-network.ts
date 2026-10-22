import { Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';

export interface RoadNetworkOptions {
  /** Roads per direction. The network is a square grid centred on the origin. */
  readonly roadsPerAxis?: number;
  /** Centre-to-centre distance between parallel roads, in metres. */
  readonly spacing?: number;
  /** Carriageway width, in metres. */
  readonly roadWidth?: number;
}

const ASPHALT_COLOR = 0x3b3f45;
const EDGE_LINE_COLOR = 0xf2f2f2;
const CENTRE_LINE_COLOR = 0xf5c542;

const LINE_WIDTH = 0.25;
const DASH_LENGTH = 3;
const DASH_GAP = 3;
const EDGE_INSET = 0.5;

/** Each layer sits a little higher than the one below it to avoid depth fighting. */
const ROAD_LEVEL = 0.02;
const MARKING_LEVEL = 0.04;

function flatMaterial(color: number, layer: number): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color,
    roughness: 0.95,
    polygonOffset: true,
    polygonOffsetFactor: -layer,
    polygonOffsetUnits: -layer,
  });
}

/** A horizontal rectangle in the XZ plane, `along` metres on X and `across` metres on Z. */
function flatStrip(along: number, across: number): PlaneGeometry {
  const geometry = new PlaneGeometry(along, across);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

/**
 * Builds a square grid of roads: asphalt, solid white edge lines and a dashed yellow centre
 * line. Markings stop at each junction, as they do on a real road.
 *
 * Pure geometry: no WebGL context is needed to build or assert it.
 */
export function createRoadNetwork(options: RoadNetworkOptions = {}): Group {
  const roadsPerAxis = options.roadsPerAxis ?? 7;
  const spacing = options.spacing ?? 60;
  const roadWidth = options.roadWidth ?? 12;

  const roadLength = (roadsPerAxis - 1) * spacing + roadWidth;
  const segmentLength = spacing - roadWidth;
  const roadCentre = (index: number): number => (index - (roadsPerAxis - 1) / 2) * spacing;

  const asphalt = flatMaterial(ASPHALT_COLOR, 1);
  const edgeMarking = flatMaterial(EDGE_LINE_COLOR, 2);
  const centreMarking = flatMaterial(CENTRE_LINE_COLOR, 2);

  const roadGeometry = flatStrip(roadLength, roadWidth);
  const edgeGeometry = flatStrip(segmentLength, LINE_WIDTH);
  const dashGeometry = flatStrip(DASH_LENGTH, LINE_WIDTH);

  const segments = roadsPerAxis - 1;
  const dashesPerSegment = Math.floor((segmentLength + DASH_GAP) / (DASH_LENGTH + DASH_GAP));
  const edgeOffset = roadWidth / 2 - EDGE_INSET;

  // Build the east-west roads once; the north-south roads are the same set turned 90 degrees.
  const eastWest = new Group();
  const dashes = new InstancedMesh(
    dashGeometry,
    centreMarking,
    dashesPerSegment * segments * roadsPerAxis,
  );
  dashes.name = 'centre-lines';
  const dashTransform = new Matrix4();
  let dashIndex = 0;

  for (let road = 0; road < roadsPerAxis; road += 1) {
    const z = roadCentre(road);

    const surface = new Mesh(roadGeometry, asphalt);
    surface.position.set(0, ROAD_LEVEL, z);
    eastWest.add(surface);

    for (let segment = 0; segment < segments; segment += 1) {
      const start = roadCentre(segment) + roadWidth / 2;
      const middle = start + segmentLength / 2;

      for (const side of [-edgeOffset, edgeOffset]) {
        const line = new Mesh(edgeGeometry, edgeMarking);
        line.position.set(middle, MARKING_LEVEL, z + side);
        eastWest.add(line);
      }

      // Centre the run of dashes within the segment.
      const runLength = dashesPerSegment * DASH_LENGTH + (dashesPerSegment - 1) * DASH_GAP;
      const runStart = middle - runLength / 2 + DASH_LENGTH / 2;
      for (let dash = 0; dash < dashesPerSegment; dash += 1) {
        dashTransform.makeTranslation(runStart + dash * (DASH_LENGTH + DASH_GAP), MARKING_LEVEL, z);
        dashes.setMatrixAt(dashIndex, dashTransform);
        dashIndex += 1;
      }
    }
  }
  eastWest.add(dashes);

  const northSouth = eastWest.clone();
  northSouth.rotation.y = Math.PI / 2;

  const network = new Group();
  network.name = 'road-network';
  network.add(eastWest, northSouth);
  return network;
}
