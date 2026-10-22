import { createViewer } from '../src/scene/create-viewer';
import type { EntityRef } from '../src/viewer-contract/events';
import type { ViewModeModel } from '../src/viewer-contract/twin-model';
import { costAssumptions, dataset } from './domain/dataset';
import { computeOrderProgress } from './domain/order-progress';
import { holderOf, raciOf, taskOf } from './domain/organization';
import { computeJobKpis, computeOrderCosts } from './domain/people-kpis';
import { computeProcessKpis } from './domain/process-kpis';
import { toRoute } from './layout/route-state';
import { OFFICE_ID } from './layout/site-plan';
import { summarisePlaces, viewKey } from './layout/site-summary';
import { buildTwinModel, truckId } from './layout/twin-layout';
import { renderBuildingCard } from './ui/building-card';
import { renderOrderChip } from './ui/order-chip';
import { requireElement } from './ui/dom';
import { createFlowBar } from './ui/flow-bar';
import { createNavigator } from './ui/navigator';
import { createOrderPanel } from './ui/order-panel';
import { createPeoplePanel } from './ui/people-panel';
import { renderProcessPanel } from './ui/process-panel';
import { createTabs } from './ui/tabs';
import { dispatchStep, planTour, sceneTitle, type TourScene } from './layout/tour-plan';
import { introCaption, outcomeCard, stopCard, type TourContext } from './ui/tour-cards';
import { createTourPlayer, type PlayerScene } from './ui/tour-player';
import { createFloorSwitch } from './ui/floor-switch';

/**
 * Composition root of the demo page, acting as the presentation layer: it reads the
 * dataset, derives KPIs and the layout, drives the viewer with commands and reacts to its
 * events.
 *
 * URL parameters open a specific state: `?order=SO-1004`, `?view=HQ-1` (building and
 * floor, or `HALL`), `?focus=E006` (a person or job code), `?tab=process`, and
 * `?play` (or `?play=3`, to start the walk at its fourth scene), and `?mode=2d` for the
 * top view.
 */
const params = new URLSearchParams(window.location.search);
const DEFAULT_ORDER = 'SO-1004';
const requestedOrder = params.get('order');
const INITIAL_ORDER = dataset.instances.some((instance) => instance.orderRef === requestedOrder)
  ? (requestedOrder ?? DEFAULT_ORDER)
  : DEFAULT_ORDER;

const jobKpis = computeJobKpis(dataset, costAssumptions);
const orderCosts = computeOrderCosts(dataset, costAssumptions);
const processKpis = computeProcessKpis(dataset);
const twin = buildTwinModel(dataset, jobKpis);

const canvas = requireElement('viewer-canvas', HTMLCanvasElement);
const viewer = createViewer(canvas);
viewer.load(twin);

requireElement('tenant-name', HTMLElement).textContent = dataset.tenant.name;
requireElement('process-name', HTMLElement).textContent =
  `${dataset.process.name} (${dataset.process.code})`;
requireElement('data-note', HTMLElement).textContent =
  `Synthetic demo data · ${dataset.instances.length} orders · ${dataset.events.length} events`;

// ---------------------------------------------------------------------------------------
// Buildings and floors

const places = summarisePlaces(dataset, twin);
const buildingCard = requireElement('building-card', HTMLElement);
const navigator = createNavigator(requireElement('nav-panel', HTMLElement), places, (place) =>
  goTo(place.view),
);

function goTo(view: ViewModeModel): void {
  viewer.setView(view);
  if (mode === '2d') floorSwitch.setCurrent(view.building ?? OFFICE_ID, view.level);
  const place = places.find((candidate) => candidate.key === viewKey(view)) ?? places[0]!;
  navigator.setActive(place.key);
  renderBuildingCard(buildingCard, place);
}

// ---------------------------------------------------------------------------------------
// 2D top view and 3D twin: the same buildings, seen straight from above or in perspective.

type Mode = '2d' | '3d';
let mode: Mode = '3d';
const modeButtons = [...document.querySelectorAll<HTMLButtonElement>('.mode-button')];
const floorSwitch = createFloorSwitch(requireElement('floor-switch', HTMLElement), (view) =>
  goTo(view),
);

function setMode(next: Mode): void {
  if (next === mode) return;
  tour.stop();
  mode = next;
  for (const button of modeButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.mode === next));
  }
  document.body.classList.toggle('is-plan', next === '2d');
  viewer.setTopView(next === '2d');
  floorSwitch.setVisible(next === '2d');
  if (next === '2d') {
    // The whole site from above, with the office's ground floor open.
    viewer.showPlanFloor(null, null);
    floorSwitch.setCurrent(OFFICE_ID, 0);
  }
  navigator.setActive('site');
  renderBuildingCard(buildingCard, places[0]!);
  showOrder(currentOrder);
}

for (const button of modeButtons) {
  button.addEventListener('click', () => setMode(button.dataset.mode === '2d' ? '2d' : '3d'));
}

/** The view that shows a workstation: its office floor, or the hall it is in. */
function viewOf(entity: EntityRef): ViewModeModel | null {
  const station = twin.workstations.find(
    (candidate) => candidate.entity.kind === entity.kind && candidate.entity.id === entity.id,
  );
  if (!station) return null;
  return {
    building: station.building,
    level: station.building === OFFICE_ID ? station.level : null,
  };
}

// ---------------------------------------------------------------------------------------
// Inspector

const tabs = createTabs(document.querySelector<HTMLElement>('.inspector')!);

const people = createPeoplePanel(
  requireElement('people-panel', HTMLElement),
  dataset,
  jobKpis,
  costAssumptions,
  twin.workstations,
  (entity) => focusOn(entity),
);

function focusOn(entity: EntityRef): void {
  const view = viewOf(entity);
  if (view) goTo(view);
  viewer.select(entity);
  viewer.focus(entity);
  people.show(entity);
  tabs.open('people');
}

/** Flies to the desk of the job Responsible for a step. */
function focusStep(stepNumber: number): void {
  if (stepNumber === dispatchStep(dataset.steps.length)) {
    viewer.focus({ kind: 'truck', id: truckId(currentOrder) });
    return;
  }
  const step = dataset.steps.find((candidate) => candidate.step === stepNumber);
  if (!step) return;
  const responsible = raciOf(dataset, taskOf(dataset, step).code)?.responsible;
  if (!responsible) return;
  const holder = holderOf(dataset, responsible);
  focusOn(holder ? { kind: 'person', id: holder.id } : { kind: 'job', id: responsible });
}

const orderPanel = createOrderPanel(
  requireElement('order-panel', HTMLElement),
  dataset,
  orderCosts,
  costAssumptions.meta.currency,
  INITIAL_ORDER,
  showOrder,
  focusStep,
);
const flowBar = createFlowBar(requireElement('flow-bar', HTMLElement), dataset, focusStep);

renderProcessPanel(
  requireElement('process-panel', HTMLElement),
  dataset,
  processKpis,
  orderCosts,
  jobKpis,
  costAssumptions,
);

const orderChip = requireElement('order-chip', HTMLElement);
let currentOrder = INITIAL_ORDER;

function showOrder(orderRef: string): void {
  if (tour.playing && orderRef !== currentOrder) tour.stop();
  currentOrder = orderRef;
  const progress = computeOrderProgress(dataset, orderRef);
  const route = toRoute(dataset, progress);
  // The order card is shown on the page, so the 3D view keeps only the route.
  viewer.setRoute({ ...route, badge: null });
  flowBar.render(progress);
  orderPanel.render(progress);
  renderOrderChip(orderChip, route.badge);
}

// ---------------------------------------------------------------------------------------
// Guided walk: from the entrance, a line is drawn on the floor to each desk in turn and
// the camera travels it inside the building; then the lorry leaves with the goods.

const tourCaption = requireElement('tour-caption', HTMLElement);
const tourOutcome = requireElement('tour-outcome', HTMLElement);
const tour = createTourPlayer(requireElement('tour-bar', HTMLElement), endTour);

/** Seconds the camera rests on each person once it has reached their desk. */
const STOP_SECONDS = 7;
/** Seconds at the entrance before the order sets off, and at the dock before the lorry leaves. */
const INTRO_SECONDS = 5;
const DISPATCH_DELAY = 3;
/** Where every order arrives: the head office's main entrance. */
const ENTRANCE = `entrance:${OFFICE_ID}`;

function playTour(startAt = 0): void {
  // A walk already running (Play again, or Play pressed mid-walk) is ended first, with its
  // usual teardown, so the setup below is never undone by it.
  tour.stop();

  const progress = computeOrderProgress(dataset, currentOrder);
  const context: TourContext = {
    dataset,
    progress,
    jobKpis,
    costs: costAssumptions,
    orderCost: orderCosts.find((cost) => cost.orderRef === currentOrder),
  };
  // Each stop is travelled to from the one before it, the first from the entrance; the
  // steps reached so far are known per scene, so jumping back and forth stays consistent.
  // In 2D the same walk is drawn on the floors from above.
  const toScene = mode === '2d' ? toPlanScene : toPlayerScene;
  let previous = ENTRANCE;
  const reached = new Set<number>();
  const scenes = planTour(progress, toRoute(dataset, progress), twin).map((scene) => {
    const player = toScene(scene, context, previous, new Set(reached));
    if (scene.kind === 'stop' || scene.kind === 'dispatch') {
      previous = scene.stop.anchor;
      reached.add(
        scene.kind === 'dispatch' ? dispatchStep(dataset.steps.length) : scene.step.step.step,
      );
    }
    return player;
  });

  viewer.clearTravel();
  viewer.resetDispatch();
  viewer.setCallout(null);
  // The walk draws its own lines; the arcs and the labels would only crowd it.
  viewer.setRoute({ stops: [], legs: [], badge: null });
  viewer.setLabelsVisible(false);
  tabs.open('order');
  document.body.classList.add('is-touring');
  tour.play(scenes, startAt);
}

/**
 * One scene of the walk. A stop first draws the line from the previous place to the
 * desk, then the camera travels it inside the building; on arrival the step lights up in
 * the flow bar and the person's card opens, on its own.
 */
function toPlayerScene(
  scene: TourScene,
  context: TourContext,
  from: string,
  reachedBefore: ReadonlySet<number>,
): PlayerScene {
  const { progress } = context;
  const title = sceneTitle(scene);
  const showReached = (current: number | null): void => {
    const reached = new Set(reachedBefore);
    if (current !== null) reached.add(current);
    flowBar.render(progress, reached);
  };

  switch (scene.kind) {
    case 'intro':
      return {
        title,
        seconds: INTRO_SECONDS,
        enter() {
          viewer.setCallout(null);
          viewer.select(null);
          flowBar.setCurrent(null);
          showReached(null);
          viewer.showPlace(ENTRANCE);
          tourCaption.replaceChildren(introCaption(context));
          tourCaption.hidden = false;
        },
        leave() {
          tourCaption.hidden = true;
        },
      };
    case 'stop':
    case 'dispatch': {
      // The dispatch is shown as its own step at the end of the flow, not as step 4 again.
      const step =
        scene.kind === 'dispatch' ? dispatchStep(dataset.steps.length) : scene.step.step.step;
      const entity = scene.kind === 'stop' ? scene.entity : scene.truck;
      return {
        title: scene.kind === 'stop' ? `${scene.stop.marker} · ${title}` : title,
        // The scene waits while the camera travels; arriving sets its time.
        seconds: null,
        pause: (paused) => viewer.pauseTravel(paused),
        enter({ later, retime }) {
          viewer.setCallout(null);
          viewer.select(null);
          showReached(null);
          flowBar.setCurrent(step);
          const arrive = (): void => {
            showReached(step);
            viewer.setCallout({ entity, element: stopCard(context, scene) });
            if (scene.kind === 'stop') {
              viewer.select(entity);
              retime(STOP_SECONDS);
              return;
            }
            // At the dock: the lorry is loaded, then pulls away.
            retime(DISPATCH_DELAY + 12);
            later(() => {
              const seconds = viewer.dispatch(scene.truck);
              if (seconds !== null) retime(seconds + 1.5);
            }, DISPATCH_DELAY);
          };
          const travelling = viewer.travelTo(scene.stop.anchor, {
            from,
            state: scene.stop.state,
            onArrive: arrive,
          });
          if (!travelling) {
            viewer.focus(entity);
            arrive();
          }
        },
      };
    }
    case 'outcome':
      return {
        title,
        seconds: null,
        enter() {
          viewer.setCallout(null);
          viewer.select(null);
          flowBar.setCurrent(null);
          flowBar.render(progress);
          goTo({ building: null, level: null });
          tourOutcome.replaceChildren(
            outcomeCard(
              context,
              () => playTour(),
              () => tour.stop(),
            ),
          );
          tourOutcome.hidden = false;
        },
        leave() {
          tourOutcome.hidden = true;
        },
      };
  }
}

/**
 * One scene of the walk in the 2D top view: the line is drawn on the real floors from the
 * previous place to the desk (the previous line goes), opening up each floor it reaches;
 * then the step lights up in the flow bar and the person's card opens beside the desk.
 */
function toPlanScene(
  scene: TourScene,
  context: TourContext,
  from: string,
  reachedBefore: ReadonlySet<number>,
): PlayerScene {
  const { progress } = context;
  const title = sceneTitle(scene);
  const showReached = (current: number | null): void => {
    const reached = new Set(reachedBefore);
    if (current !== null) reached.add(current);
    flowBar.render(progress, reached);
  };
  const onStorey = (building: string, level: number): void =>
    floorSwitch.setCurrent(building, level);
  switch (scene.kind) {
    case 'intro':
      return {
        title,
        seconds: INTRO_SECONDS,
        enter() {
          viewer.clearTravel();
          viewer.setCallout(null);
          flowBar.setCurrent(null);
          showReached(null);
          viewer.showPlanFloor(OFFICE_ID, 0);
          floorSwitch.setCurrent(OFFICE_ID, 0);
          tourCaption.replaceChildren(introCaption(context));
          tourCaption.hidden = false;
        },
        leave() {
          tourCaption.hidden = true;
        },
      };
    case 'stop':
    case 'dispatch': {
      // The dispatch is shown as its own step at the end of the flow, not as step 4 again.
      const step =
        scene.kind === 'dispatch' ? dispatchStep(dataset.steps.length) : scene.step.step.step;
      const entity = scene.kind === 'stop' ? scene.entity : scene.truck;
      return {
        title: scene.kind === 'stop' ? `${scene.stop.marker} · ${title}` : title,
        seconds: null,
        pause: (paused) => viewer.pauseTravel(paused),
        enter({ later, retime }) {
          viewer.setCallout(null);
          viewer.select(null);
          showReached(null);
          flowBar.setCurrent(step);
          if (scene.kind === 'dispatch') viewer.resetDispatch();
          const arrive = (): void => {
            showReached(step);
            viewer.select(entity);
            viewer.setCallout({ entity, element: stopCard(context, scene) });
            if (scene.kind === 'stop') {
              retime(STOP_SECONDS);
              return;
            }
            retime(DISPATCH_DELAY + 12);
            later(() => {
              viewer.select(null);
              const seconds = viewer.dispatch(scene.truck);
              if (seconds !== null) retime(seconds + 1.5);
            }, DISPATCH_DELAY);
          };
          const drawing = viewer.drawPath(scene.stop.anchor, {
            from,
            state: scene.stop.state,
            onStorey,
            onArrive: arrive,
          });
          if (!drawing) arrive();
        },
      };
    }
    case 'outcome':
      return {
        title,
        seconds: null,
        enter() {
          viewer.clearTravel();
          viewer.setCallout(null);
          viewer.select(null);
          flowBar.setCurrent(null);
          flowBar.render(progress);
          viewer.showPlanFloor(null, null);
          tourOutcome.replaceChildren(
            outcomeCard(
              context,
              () => playTour(),
              () => tour.stop(),
            ),
          );
          tourOutcome.hidden = false;
        },
        leave() {
          tourOutcome.hidden = true;
        },
      };
  }
}

function endTour(): void {
  viewer.setCallout(null);
  viewer.clearTravel();
  viewer.resetDispatch();
  viewer.select(null);
  viewer.setLabelsVisible(true);
  flowBar.setCurrent(null);
  tourCaption.hidden = true;
  tourOutcome.hidden = true;
  document.body.classList.remove('is-touring');
  // Back to the order's full route and states.
  showOrder(currentOrder);
}

requireElement('play-tour', HTMLButtonElement).addEventListener('click', () => playTour());

// ---------------------------------------------------------------------------------------
// Viewer events

viewer.on((event) => {
  if (event.type !== 'select') return;
  const { entity } = event;
  if (entity.kind === 'building') {
    goTo({ building: entity.id, level: null });
  } else if (entity.kind === 'truck') {
    const orderRef = entity.id.replace(/^TRUCK-/, '');
    showOrder(orderRef);
    tabs.open('order');
  } else {
    people.show(entity);
    tabs.open('people');
  }
});

requireElement('reset-view', HTMLButtonElement).addEventListener('click', () => {
  tour.stop();
  if (mode === '3d') viewer.resetView();
  else viewer.showPlanFloor(null, null);
  navigator.setActive('site');
  renderBuildingCard(buildingCard, places[0]!);
});

// ---------------------------------------------------------------------------------------
// Start-up

showOrder(INITIAL_ORDER);
navigator.setActive('site');
renderBuildingCard(buildingCard, places[0]!);

if (params.get('mode') === '2d') setMode('2d');
const requestedView = params.get('view');
if (requestedView) {
  const [building, level] = requestedView.split('-');
  goTo({ building: building ?? null, level: level === undefined ? null : Number(level) });
}
const requestedTab = params.get('tab');
if (requestedTab === 'order' || requestedTab === 'people' || requestedTab === 'process') {
  tabs.open(requestedTab);
}
const requestedFocus = params.get('focus');
if (requestedFocus) {
  const isPerson = dataset.persons.some((person) => person.id === requestedFocus);
  focusOn({ kind: isPerson ? 'person' : 'job', id: requestedFocus });
}
if (params.has('play')) playTour(Number(params.get('play')) || 0);

/** The floating panels cover the canvas edges; the camera frames what is left. */
function measureInsets(): void {
  const stage = canvas.getBoundingClientRect();
  const nav = requireElement('nav-panel', HTMLElement).getBoundingClientRect();
  const inspector = document.querySelector<HTMLElement>('.inspector')!.getBoundingClientRect();
  const flow = requireElement('flow-bar', HTMLElement).getBoundingClientRect();
  viewer.setInsets({
    top: 0,
    left: Math.max(0, nav.right - stage.left),
    right: Math.max(0, stage.right - inspector.left),
    bottom: Math.max(0, stage.bottom - flow.top),
  });
}

const observer = new ResizeObserver(([entry]) => {
  if (!entry) return;
  viewer.resize(entry.contentRect.width, entry.contentRect.height);
  measureInsets();
});
observer.observe(canvas);
measureInsets();

window.addEventListener('beforeunload', () => {
  observer.disconnect();
  viewer.dispose();
});
