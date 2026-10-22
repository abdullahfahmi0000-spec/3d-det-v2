import {
  ACESFilmicToneMapping,
  Box3,
  MathUtils,
  PCFShadowMap,
  PMREMGenerator,
  Vector3,
  WebGLRenderer,
  type Object3D,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

import type { NavPoint } from '../building/create-navigation';
import { createSite, type Site } from '../building/create-site';
import { createCamera } from '../camera/create-camera';
import { createCameraRig, MAP_TILT } from '../camera/create-camera-rig';
import { createSelectionMarker } from '../highlighting/create-selection-marker';
import { detachLabels, type LabelNote } from '../overlays/create-label';
import { createPathArrows, type PathArrow } from '../process-route/create-path-arrows';
import { createPointer } from '../highlighting/create-pointer';
import { createProcessRoute } from '../process-route/create-process-route';
import { createPicker } from '../selection/create-picker';
import type { EntityRef, ViewerEvent, ViewerEventHandler } from '../viewer-contract/events';
import {
  emptyRoute,
  entityKey,
  type ProcessNodeState,
  type RouteModel,
  type TwinViewModel,
  type ViewModeModel,
} from '../viewer-contract/twin-model';
import { createScene } from './create-scene';
import { disposeObject } from './dispose-object';

export interface ViewerHandle {
  /** Replaces the twin with a new layout and flies to the site overview. */
  load(model: TwinViewModel): void;
  /**
   * Opens up a building or one floor of it (hiding everything above) and flies the camera
   * to it. `{ building: null, level: null }` is the site overview.
   */
  setView(view: ViewModeModel): void;
  /** Draws the path the order being shown takes through the building. */
  setRoute(route: RouteModel): void;
  /** Flies the camera to an entity; emits `focus` events as it starts and settles. */
  focus(entity: EntityRef, options?: FocusOptions): void;
  /**
   * Pins a host-built element beside an entity, such as a card about the person at a desk.
   * It follows the entity if it moves. `null` removes it.
   */
  setCallout(callout: Callout | null): void;
  /**
   * Drives a docked truck out to the road and keeps the camera on it. Returns the seconds
   * it takes to reach the road, or null for an unknown truck.
   */
  dispatch(truck: EntityRef): number | null;
  /** Puts dispatched trucks back at their docks. */
  resetDispatch(): void;
  /**
   * Frames a place (a workstation, a truck, or `entrance:<building>`) from a short way
   * off, as someone arriving would see it.
   */
  showPlace(place: string, onSettled?: () => void): boolean;
  /**
   * Draws a wayfinding line on the floor from one place to another (through doors,
   * corridors, stairs and walkways), then moves the camera along it inside the buildings,
   * with every floor and roof in place, and settles on the place. The line of the previous
   * travel is removed, so only the way to the current destination shows. Returns false
   * when there is no route.
   */
  travelTo(place: string, options: TravelOptions): boolean;
  /** Holds a travel in progress where it is, or lets it carry on. */
  pauseTravel(paused: boolean): void;
  /** Removes the wayfinding lines. */
  clearTravel(): void;
  /** Hides every label in the twin (callouts excepted), so one card can speak alone. */
  setLabelsVisible(visible: boolean): void;
  /** Stops or restarts drawing, such as while another view covers the canvas. */
  setRendering(enabled: boolean): void;
  /**
   * The 2D view: the real buildings seen straight from above, an office floor opened up
   * and the hall's roof off. Dragging pans and the wheel zooms. Off returns to the 3D
   * overview.
   */
  setTopView(enabled: boolean): void;
  /**
   * In the top view, opens up one floor of a building (the others below it stay hidden
   * under it) and frames it. With `building` null the whole site is framed.
   */
  showPlanFloor(building: string | null, level: number | null): void;
  /**
   * In the top view, draws the wayfinding line from one place to another along the real
   * floors, opening up each floor as the line reaches it, then frames the destination.
   * The previous line is removed first. Returns false when there is no route.
   */
  drawPath(place: string, options: DrawPathOptions): boolean;
  /** Marks an entity as selected without emitting a `select` event. */
  select(entity: EntityRef | null): void;
  /** Flies back to the opening view. */
  resetView(): void;
  /** Subscribes to viewer events; returns the unsubscribe function. */
  on(handler: ViewerEventHandler): () => void;
  /** Applies a new drawing-buffer size. */
  resize(width: number, height: number): void;
  /**
   * Tells the viewer which edges of the canvas are covered by the host page's panels, in
   * pixels. The camera then centres and frames its subject in the uncovered area.
   */
  setInsets(insets: Insets): void;
  /** Stops the animation loop and releases the WebGL context and GPU resources. */
  dispose(): void;
  /** Frames rendered since start, used by the bootstrap check. */
  frameCount(): number;
}

export interface FocusOptions {
  /** Camera tilt in radians down from the horizontal; steeper clears tall walls. */
  readonly pitch?: number;
  /** Multiplies the framing distance. */
  readonly zoom?: number;
}

export interface DrawPathOptions {
  readonly from: string;
  readonly state?: ProcessNodeState;
  /** Called when the line reaches another floor, with the floor it is now on. */
  readonly onStorey?: (building: string, level: number) => void;
  readonly onArrive?: () => void;
}

/**
 * Where a callout card hangs from its subject, as a fraction of the card: just off its
 * left edge, a little below the middle. Exposed to CSS as `--callout-anchor-y`.
 */
const CALLOUT_ANCHOR = { x: -0.06, y: 0.62 } as const;

/** How often, in frames, overlapping labels are pushed apart. */
const DECLUTTER_EVERY = 6;
/** Labels that are kept apart on screen, most important first. */
const DECLUTTERED = [
  'twin-label--callout',
  'twin-label--floor-tag',
  'twin-label--person',
  'twin-label--dock',
  'twin-label--zone',
  'twin-label--room',
];
const LABEL_GAP = 4;

/**
 * Pushes overlapping labels apart, so names never sit on top of each other. Each label
 * keeps its place unless it overlaps one already placed, in which case it moves up just
 * clear of it. The shift uses the CSS `translate` property, which adds to the transform
 * the label renderer sets every frame.
 */
function declutter(layer: HTMLElement, insets: Insets): void {
  const area = layer.getBoundingClientRect();
  const placed: DOMRect[] = [];
  const items: { element: HTMLElement; rect: DOMRect; rank: number; shiftX: number }[] = [];
  for (const element of layer.querySelectorAll<HTMLElement>('.twin-label')) {
    if (element.style.display === 'none') continue;
    const rank = DECLUTTERED.findIndex((variant) => element.classList.contains(variant));
    if (rank < 0) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width === 0) continue;
    // Measure where the label would be without its current shift.
    const x = rect.x - Number(element.dataset.shiftX ?? 0);
    const y = rect.y - Number(element.dataset.shift ?? 0);
    // Area cards are kept inside the part of the view the panels leave uncovered.
    let shiftX = 0;
    if (rank === 0) {
      const left = area.left + insets.left + LABEL_GAP * 2;
      const right = area.right - insets.right - LABEL_GAP * 2;
      shiftX = Math.round(Math.min(Math.max(x, left), Math.max(left, right - rect.width)) - x);
    }
    items.push({
      element,
      rect: new DOMRect(x + shiftX, y, rect.width, rect.height),
      rank,
      shiftX,
    });
  }
  items.sort((a, b) => a.rank - b.rank || b.rect.bottom - a.rect.bottom);
  for (const { element, rect, shiftX } of items) {
    let top = rect.y;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const hit = placed.find(
        (other) =>
          rect.x < other.right + LABEL_GAP &&
          other.x < rect.right + LABEL_GAP &&
          top < other.bottom + LABEL_GAP &&
          other.y < top + rect.height + LABEL_GAP,
      );
      if (!hit) break;
      top = hit.y - rect.height - LABEL_GAP;
    }
    const shift = Math.round(top - rect.y);
    element.dataset.shift = String(shift);
    element.dataset.shiftX = String(shiftX);
    const translate = shift === 0 && shiftX === 0 ? '' : `${shiftX}px ${shift}px`;
    if (element.style.translate !== translate) element.style.translate = translate;
    placed.push(new DOMRect(rect.x, top, rect.width, rect.height));
  }
}

/** Field of view of the top view: narrow, so the plan looks flat, like a drawing. */
const TOP_FOV = 26;
const PERSPECTIVE_FOV = 55;
/** Pitch of the top view: as near straight down as the camera rig allows. */
const TOP_PITCH = Math.PI / 2 - MAP_TILT / 2;

export interface TravelOptions {
  readonly from: string;
  /** Colour of the line, by the state of the step it leads to. */
  readonly state?: ProcessNodeState;
  /** Called when the camera has settled at the place. */
  readonly onArrive?: () => void;
}

/** Travel pacing: how long the line takes to draw, then the camera's walking pace. */
const TRAVEL = {
  drawSpeed: 18,
  minDraw: 1.2,
  maxDraw: 3,
  speed: 3.2,
  maxSeconds: 18,
  /** Beyond this the camera flies to the start of the line before gliding along it. */
  joinDistance: 30,
} as const;
/** Camera height above the floor while moving, and once settled at a desk or a dock. */
const EYE_HEIGHT = 1.9;
const SETTLE = { back: 4.8, height: 3.3, truckBack: 9, truckHeight: 5 } as const;

export interface Callout {
  readonly entity: EntityRef;
  readonly element: HTMLElement;
}

export interface Insets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/** Camera tilt for each kind of view: a three-quarter view outside, steeper for floor plans. */
const PITCH = {
  site: MathUtils.degToRad(32),
  building: MathUtils.degToRad(28),
  floor: MathUtils.degToRad(58),
  person: MathUtils.degToRad(38),
} as const;

/**
 * The viewer: renders the twin it is given and reports what the user does with it.
 *
 * It owns the WebGL renderer, a label layer for screen-space text, the camera rig and the
 * render loop. It holds no business logic: layout, KPI texts and states all arrive through
 * `load`, `setView` and `setRoute`, and user intent leaves through `on`.
 */
export function createViewer(canvas: HTMLCanvasElement): ViewerHandle {
  const container = canvas.parentElement ?? document.body;

  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const labels = new CSS2DRenderer();
  labels.domElement.className = 'twin-label-layer';
  container.append(labels.domElement);

  const { scene, content } = createScene();
  // A soft studio environment gives glass and metal something to reflect.
  const pmrem = new PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = environment;
  scene.environmentIntensity = 0.45;

  const camera = createCamera({ aspect: canvas.clientWidth / Math.max(canvas.clientHeight, 1) });
  const rig = createCameraRig(camera, canvas, {
    home: { position: new Vector3(-60, 120, 190), target: new Vector3(0, 0, 0) },
  });

  const marker = createSelectionMarker();
  const route = createProcessRoute();
  const arrows = createPathArrows();
  scene.add(marker.mesh, route.root, arrows.root);

  /** A travel being drawn, then flown; null when none is in progress. */
  let travel: {
    readonly arrow: PathArrow;
    readonly drawSeconds: number;
    readonly start: () => void;
    drawn: number;
  } | null = null;
  let travelPaused = false;
  let topView = false;
  /** A 2D path being drawn: the line grows along the floors and opens each one up. */
  let pathDraw: {
    readonly arrow: PathArrow;
    readonly points: readonly NavPoint[];
    readonly lengths: readonly number[];
    readonly drawSeconds: number;
    readonly onStorey: ((building: string, level: number) => void) | undefined;
    readonly onDone: () => void;
    storey: string;
    drawn: number;
  } | null = null;

  const handlers = new Set<ViewerEventHandler>();
  const emit = (event: ViewerEvent): void => handlers.forEach((handler) => handler(event));

  let site: Site | null = null;
  let currentRoute: RouteModel = emptyRoute();
  const lookup = (entity: EntityRef): Object3D | undefined => site?.registry.get(entityKey(entity));

  /** Writes each stop onto its desk's label, and draws the arcs and remaining labels. */
  const drawRoute = (): void => {
    if (!site) return;
    const notes = new Map<string, LabelNote[]>();
    for (const stop of currentRoute.stops) {
      const list = notes.get(stop.anchor) ?? [];
      list.push({
        marker: stop.marker,
        title: stop.title,
        subtitle: stop.subtitle,
        state: stop.state,
      });
      notes.set(stop.anchor, list);
    }
    route.setRoute(currentRoute, site.anchors, site.annotate(notes));
  };

  const picker = createPicker(
    canvas,
    camera,
    () => (site ? [site.root] : []),
    (entity, object) => {
      marker.show(object);
      if (entity) emit({ type: 'select', entity });
      else emit({ type: 'highlight', entities: [] });
    },
  );

  let callout: CSS2DObject | null = null;
  const pointer = createPointer();
  scene.add(pointer.root);
  const clearCallout = (): void => {
    pointer.show(null);
    if (!callout) return;
    callout.element.remove();
    callout.removeFromParent();
    callout = null;
  };

  const unload = (): void => {
    clearCallout();
    if (site) {
      content.remove(site.root);
      detachLabels(site.root);
      disposeObject(site.root);
    }
    site = null;
    marker.show(null);
  };

  let frames = 0;
  let lastTimestamp: number | null = null;

  const renderFrame = (timestamp: number): void => {
    // First frame has no predecessor, so it advances by zero.
    const deltaSeconds =
      lastTimestamp === null ? 0 : Math.min((timestamp - lastTimestamp) / 1000, 0.1);
    lastTimestamp = timestamp;
    const elapsed = timestamp / 1000;

    // A travel first draws its line along the floor, then sends the camera along it.
    if (travel && !travelPaused) {
      travel.drawn = Math.min(travel.drawSeconds, travel.drawn + deltaSeconds);
      travel.arrow.reveal(travel.drawn / travel.drawSeconds);
      if (travel.drawn >= travel.drawSeconds) {
        const start = travel.start;
        travel = null;
        start();
      }
    }
    if (pathDraw && !travelPaused && site) {
      pathDraw.drawn = Math.min(pathDraw.drawSeconds, pathDraw.drawn + deltaSeconds);
      const fraction = pathDraw.drawn / pathDraw.drawSeconds;
      pathDraw.arrow.reveal(fraction);
      // The floor the tip of the line is on is the one opened up.
      const reach = fraction * (pathDraw.lengths[pathDraw.lengths.length - 1] ?? 0);
      let index = 1;
      while (index < pathDraw.lengths.length - 1 && pathDraw.lengths[index]! < reach) index += 1;
      const tip = pathDraw.points[index] ?? pathDraw.points[pathDraw.points.length - 1]!;
      const storey = `${tip.building}#${tip.level}`;
      if (storey !== pathDraw.storey && !site.isHall(tip.building)) {
        pathDraw.storey = storey;
        site.setView({ building: tip.building, level: tip.level, plan: true });
        pathDraw.onStorey?.(tip.building, tip.level);
      }
      if (pathDraw.drawn >= pathDraw.drawSeconds) {
        const done = pathDraw.onDone;
        pathDraw = null;
        done();
      }
    }
    arrows.update(elapsed);
    rig.update(deltaSeconds);
    site?.update(elapsed, camera.position);
    route.update(elapsed, camera.position);
    marker.update(elapsed);
    pointer.update(elapsed, topView);

    renderer.render(scene, camera);
    labels.render(scene, camera);
    if (frames % DECLUTTER_EVERY === 0) declutter(labels.domElement, insets);
    frames += 1;
  };

  let insets: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
  let size = { width: 1, height: 1 };

  /**
   * Moves the centre of projection to the middle of the uncovered area by rendering an
   * off-centre window of a larger virtual frame.
   */
  const applyProjection = (): void => {
    const { width, height } = size;
    const dx = (insets.left - insets.right) / 2;
    const dy = (insets.top - insets.bottom) / 2;
    const fullWidth = width + 2 * Math.abs(dx);
    const fullHeight = height + 2 * Math.abs(dy);
    camera.aspect = fullWidth / Math.max(fullHeight, 1);
    if (dx === 0 && dy === 0) camera.clearViewOffset();
    else {
      camera.setViewOffset(
        fullWidth,
        fullHeight,
        Math.abs(dx) - dx,
        Math.abs(dy) - dy,
        width,
        height,
      );
    }
    camera.updateProjectionMatrix();
  };

  const visibleShare = (): { x: number; y: number } => ({
    x: Math.max(0.2, (size.width - insets.left - insets.right) / size.width),
    y: Math.max(0.2, (size.height - insets.top - insets.bottom) / size.height),
  });

  const resize = (width: number, height: number): void => {
    size = { width: Math.max(width, 1), height: Math.max(height, 1) };
    applyProjection();
    renderer.setSize(width, height, false);
    labels.setSize(width, height);
  };

  resize(canvas.clientWidth || 1, canvas.clientHeight || 1);
  renderer.setAnimationLoop(renderFrame);

  /** True from loading until the camera is first sent somewhere else. */
  let pristine = true;

  /**
   * The opening view looks over the whole site from the south-west, framed so both
   * buildings, the car park and the yard fit in the area the panels leave uncovered.
   */
  const placeHome = (jump: boolean): void => {
    if (!site) return;
    const overview = site.boundsFor({ building: null, level: null });
    const centre = overview.getCenter(new Vector3()).add(new Vector3(0, 0, 10));
    const radius = overview.getSize(new Vector3()).length() / 2;
    const share = visibleShare();
    const tanY =
      Math.tan(MathUtils.degToRad(camera.fov / 2)) *
      (size.height / (camera.view?.fullHeight ?? size.height));
    const halfFov = Math.atan(tanY * share.y);
    const halfFovX = Math.atan(tanY * (size.width / size.height) * share.x);
    const heading = MathUtils.degToRad(-24);
    const distance = (radius / Math.sin(Math.min(halfFov, halfFovX))) * 0.84;
    const position = new Vector3(
      centre.x + Math.sin(heading) * Math.cos(PITCH.site) * distance,
      Math.sin(PITCH.site) * distance,
      centre.z + Math.cos(heading) * Math.cos(PITCH.site) * distance,
    );
    rig.setHome(position, centre);
    if (jump) {
      camera.position.copy(position);
      rig.reset();
    }
  };

  /** Frames ground bounds straight from above, north up. */
  const frameTop = (bounds: Box3, onSettled?: () => void, zoom = 0.82): void => {
    const flat = bounds.clone();
    flat.max.y = flat.min.y + 1;
    rig.frame(flat, {
      pitch: TOP_PITCH,
      heading: 0,
      zoom,
      visible: visibleShare(),
      onSettled,
    });
  };

  const frameView = (view: ViewModeModel): void => {
    if (!site) return;
    const bounds = site.boundsFor(view);
    const pitch =
      view.building === null ? PITCH.site : view.level === null ? PITCH.building : PITCH.floor;
    const zoom = view.building === null ? 0.78 : view.level === null ? 0.8 : 0.74;
    rig.frame(bounds, { pitch, zoom, visible: visibleShare() });
  };

  return {
    load(model) {
      unload();
      site = createSite(model);
      travel = null;
      arrows.clear();
      content.add(site.root);

      pristine = true;
      placeHome(true);
      drawRoute();
    },
    setView(view) {
      pristine = false;
      marker.show(null);
      if (topView) {
        site?.setView({ ...view, plan: true });
        if (site) frameTop(site.boundsFor(view));
        return;
      }
      site?.setView(view);
      frameView(view);
    },
    setRoute(next) {
      currentRoute = next;
      drawRoute();
    },
    focus(entity, options = {}) {
      const target = lookup(entity);
      if (!target) return;
      pristine = false;
      emit({ type: 'focus', entity, settled: false });
      const bounds = new Box3().setFromObject(target);
      // People are framed with room around them so their desk and neighbours show.
      const isPlace = entity.kind === 'person' || entity.kind === 'job' || entity.kind === 'seat';
      if (isPlace) bounds.expandByScalar(3.5);
      if (topView) {
        bounds.expandByScalar(isPlace ? 4 : 2);
        frameTop(bounds);
        return;
      }
      rig.frame(bounds, {
        pitch: options.pitch ?? (isPlace ? PITCH.person : undefined),
        zoom: options.zoom ?? (isPlace ? 1 : 0.9),
        visible: visibleShare(),
        onSettled: () => emit({ type: 'focus', entity, settled: true }),
      });
    },
    select(entity) {
      marker.show(entity ? (lookup(entity) ?? null) : null);
    },
    setCallout(next) {
      clearCallout();
      const target = next ? lookup(next.entity) : undefined;
      if (!next || !target) return;
      callout = new CSS2DObject(next.element);
      callout.name = 'callout';
      // Beside the head of a person, above the cab of a truck.
      const anchor = site?.anchors.get(next.entity.id);
      const height = anchor ? anchor.y - target.getWorldPosition(new Vector3()).y : 2;
      callout.position.set(0, height + 0.3, 0);
      callout.center.set(CALLOUT_ANCHOR.x, CALLOUT_ANCHOR.y);
      // The host page aims the card's tail at the anchor with this property.
      next.element.style.setProperty('--callout-anchor-y', `${CALLOUT_ANCHOR.y * 100}%`);
      target.add(callout);
      // Point at the person themself: their seat, not the whole desk group.
      if (anchor) pointer.show(anchor, next.entity.kind !== 'truck');
    },
    dispatch(truck) {
      const departure = site?.dispatch(truck.id);
      if (!departure) return null;
      // The pin marks the lorry at its dock; once it drives off, the card rides with it.
      pointer.show(null);
      pristine = false;
      rig.frame(departure.bounds, {
        pitch: topView ? TOP_PITCH : PITCH.building,
        heading: topView ? 0 : undefined,
        zoom: topView ? 1.1 : 0.85,
        visible: visibleShare(),
      });
      return departure.seconds;
    },
    resetDispatch() {
      site?.resetDispatch();
    },
    showPlace(place, onSettled) {
      const spot = site?.navigation.visit(place);
      if (!spot) return false;
      pristine = false;
      const facing = new Vector3(Math.sin(spot.facing), 0, Math.cos(spot.facing));
      const at = spot.point.position;
      const target = at
        .clone()
        .addScaledVector(facing, 2)
        .setY(at.y + 1.6);
      const position = at
        .clone()
        .addScaledVector(facing, -11)
        .setY(at.y + 4.2);
      rig.moveTo(position, target, onSettled);
      return true;
    },
    travelTo(place, options) {
      if (!site) return false;
      const path = site.navigation.route(options.from, place);
      const spot = site.navigation.visit(place);
      if (!path || !spot || path.length < 2) return false;
      pristine = false;
      marker.show(null);
      // Inside the buildings: every floor and roof in place, ceilings overhead.
      site.setView({ building: null, level: null, interior: true });

      // Only the way to the current destination is shown: the last leg's line goes.
      arrows.clear();
      const floorPoints = path.map((point) => point.position.clone());
      const arrow = arrows.add(floorPoints, options.state ?? 'active');
      const drawSeconds = Math.min(
        TRAVEL.maxDraw,
        Math.max(TRAVEL.minDraw, arrow.length / TRAVEL.drawSpeed),
      );

      // The camera settles behind the visitor's spot, raised, looking at the subject.
      const end = floorPoints[floorPoints.length - 1]!;
      const before = floorPoints[Math.max(0, floorPoints.length - 3)]!;
      const arriving = end.clone().sub(before).setY(0).normalize();
      const isTruck =
        place.startsWith('TRUCK-') || site.registry.has(entityKey({ kind: 'truck', id: place }));
      const subject = site.anchors.get(place)?.clone() ?? end.clone().setY(end.y + 1.4);
      const finish = {
        position: end
          .clone()
          .addScaledVector(arriving, -(isTruck ? SETTLE.truckBack : SETTLE.back))
          .setY(end.y + (isTruck ? SETTLE.truckHeight : SETTLE.height)),
        target: subject,
      };
      // Eye-level points along the path, stopping short of the end so the camera rises
      // into its settled position instead of overshooting and turning back. On a stair the
      // camera does not follow the flights round the landing (a half-turn that disorients):
      // it rises or sinks straight through the stairwell, facing the way it is going.
      const levelPoints: Vector3[] = [];
      for (const point of path) {
        const floorHeight = site.elevation(point.building, point.level);
        if (Math.abs(point.position.y - floorHeight) > 0.05) continue;
        const at = point.position.clone();
        const previous = levelPoints[levelPoints.length - 1];
        if (previous && Math.abs(at.y - previous.y) > 0.5) {
          levelPoints.push(
            at.y > previous.y ? previous.clone().setY(at.y) : new Vector3(at.x, previous.y, at.z),
          );
        }
        levelPoints.push(at);
      }
      const eye = levelPoints
        .filter((point) => point.distanceTo(end) > SETTLE.back + 0.6)
        .map((point) => point.clone().setY(point.y + EYE_HEIGHT));

      travel = {
        arrow,
        drawSeconds,
        drawn: 0,
        start: () => {
          const glide = (): void => {
            rig.glide(eye, {
              speed: TRAVEL.speed,
              maxSeconds: TRAVEL.maxSeconds,
              finish,
              onArrive: () => {
                arrow.setState('done');
                options.onArrive?.();
              },
            });
          };
          // From far off (a scene skipped to), first fly in behind the start of the line.
          const first = eye[0] ?? finish.position;
          if (camera.position.distanceTo(first) <= TRAVEL.joinDistance) {
            glide();
            return;
          }
          const next = eye[Math.min(2, eye.length - 1)] ?? finish.position;
          const ahead = next.clone().sub(first).setY(0);
          if (ahead.lengthSq() === 0) ahead.set(0, 0, 1);
          ahead.normalize();
          rig.moveTo(
            first
              .clone()
              .addScaledVector(ahead, -3)
              .setY(first.y + 1),
            next,
            glide,
          );
        },
      };
      travelPaused = false;
      return true;
    },
    pauseTravel(paused) {
      travelPaused = paused;
      rig.pauseGlide(paused);
    },
    clearTravel() {
      travel = null;
      pathDraw = null;
      travelPaused = false;
      rig.pauseGlide(false);
      arrows.clear();
    },
    setLabelsVisible(visible) {
      site?.setLabelsVisible(visible);
    },
    setTopView(enabled) {
      if (enabled === topView) return;
      topView = enabled;
      // The opening view no longer follows panel resizes once the user has changed view.
      pristine = false;
      pathDraw = null;
      travel = null;
      arrows.clear();
      marker.show(null);
      rig.setMapMode(enabled);
      // The order's arcs float over the buildings; from above the floor lines tell the way.
      route.root.visible = !enabled;
      camera.fov = enabled ? TOP_FOV : PERSPECTIVE_FOV;
      applyProjection();
      if (!site) return;
      if (enabled) {
        site.setView({ building: null, level: null, plan: true });
        frameTop(site.boundsFor({ building: null, level: null }), undefined, 1);
      } else {
        site.setView({ building: null, level: null });
        rig.reset();
      }
    },
    showPlanFloor(building, level) {
      if (!site) return;
      site.setView({ building, level, plan: true });
      frameTop(site.boundsFor({ building, level }), undefined, building === null ? 1 : 0.9);
    },
    drawPath(place, options) {
      if (!site) return false;
      const path = site.navigation.route(options.from, place);
      if (!path || path.length < 2) return false;
      pristine = false;
      marker.show(null);
      arrows.clear();
      const arrow = arrows.add(
        path.map((point) => point.position.clone()),
        options.state ?? 'active',
      );
      const lengths = [0];
      for (let index = 1; index < path.length; index += 1) {
        lengths.push(
          lengths[index - 1]! + path[index]!.position.distanceTo(path[index - 1]!.position),
        );
      }
      const first = path[0]!;
      site.setView({ building: first.building, level: first.level, plan: true });
      options.onStorey?.(first.building, first.level);

      // Frame the whole way from above, then close in on the destination once drawn.
      const bounds = new Box3().setFromPoints(path.map((point) => point.position));
      bounds.expandByScalar(5);
      frameTop(bounds);
      const end = path[path.length - 1]!.position;
      pathDraw = {
        arrow,
        points: path,
        lengths,
        drawSeconds: Math.min(
          TRAVEL.maxDraw + 1.5,
          Math.max(TRAVEL.minDraw + 0.6, arrow.length / 14),
        ),
        onStorey: options.onStorey,
        storey: `${first.building}#${first.level}`,
        drawn: 0,
        onDone: () => {
          arrow.setState('done');
          const near = new Box3().setFromCenterAndSize(end, new Vector3(22, 2, 16));
          frameTop(near);
          options.onArrive?.();
        },
      };
      travelPaused = false;
      return true;
    },
    setRendering(enabled) {
      lastTimestamp = null;
      renderer.setAnimationLoop(enabled ? renderFrame : null);
      labels.domElement.style.visibility = enabled ? '' : 'hidden';
    },
    resetView() {
      site?.setView({ building: null, level: null });
      rig.reset();
    },
    on(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    resize,
    setInsets(next) {
      insets = next;
      applyProjection();
      // Until the user moves away, the opening view follows the panels' new size.
      placeHome(pristine);
    },
    dispose() {
      renderer.setAnimationLoop(null);
      picker.dispose();
      rig.dispose();
      unload();
      route.dispose();
      arrows.dispose();
      disposeObject(scene);
      environment.dispose();
      pmrem.dispose();
      labels.domElement.remove();
      handlers.clear();
      renderer.dispose();
    },
    frameCount: () => frames,
  };
}
