import { el } from './dom';

/** One scene of a guided walk, as the player runs it. */
export interface PlayerScene {
  readonly title: string;
  /**
   * How long the scene lasts; null waits, either for the scene to call `retime` (such as
   * when a walker arrives) or for the user to move on.
   */
  readonly seconds: number | null;
  /** Starts the scene. A returned number replaces `seconds`. */
  enter(controls: SceneControls): number | void;
  leave?(): void;
  /** Pauses or resumes whatever the scene animates, such as a walk in progress. */
  pause?(paused: boolean): void;
}

export interface SceneControls {
  /** Schedules work inside the scene; it is cancelled when the scene is left. */
  later(work: () => void, seconds: number): void;
  /** Ends the scene `seconds` from now instead of at its planned time. */
  retime(seconds: number): void;
}

export interface TourPlayer {
  /** Starts the walk, optionally at a later scene, stepping on by itself. */
  play(scenes: readonly PlayerScene[], startAt?: number): void;
  stop(): void;
  readonly playing: boolean;
  /** Whether the walk steps on by itself, rather than only when asked to. */
  readonly automatic: boolean;
}

/**
 * Runs a guided walk scene by scene, with a control bar: back, pause or resume, next, the
 * scene counter and a progress track whose current segment fills over the scene's length,
 * any `tools` the page adds, and stop.
 *
 * Each scene follows the last by itself once its time is up. Stepping back or on by hand
 * makes the walk manual: a scene then stays until the next step is asked for. The Auto
 * button lets it step on by itself again.
 */
export function createTourPlayer(
  bar: HTMLElement,
  onStop: () => void,
  tools: readonly HTMLElement[] = [],
): TourPlayer {
  let scenes: readonly PlayerScene[] = [];
  let index = -1;
  let timer: number | undefined;
  let deadline = 0;
  let remaining = 0;
  let paused = false;
  let sceneTimers: number[] = [];
  let automatic = true;
  /** Whether the scene shown has run its time, and waits only for a step by hand. */
  let finished = false;

  const label = el('span', { className: 'tour-label' });
  const track = el('div', { className: 'tour-track' });
  const button = (text: string, title: string, action: () => void): HTMLButtonElement => {
    const control = el('button', {
      className: 'tour-button',
      text,
      attributes: { type: 'button', title, 'aria-label': title },
    });
    control.addEventListener('click', action);
    return control;
  };
  const back = button('‹', 'Previous step', () => {
    setAutomatic(false);
    go(index - 1);
  });
  const pause = button('Pause', 'Pause', () => (paused ? resume() : hold()));
  const next = button('›', 'Next step', () => {
    setAutomatic(false);
    go(index + 1);
  });
  const mode = button('Auto', '', () => setAutomatic(!automatic));
  const stop = button('Stop', 'Stop the walk', () => end());
  pause.classList.add('wide');
  mode.classList.add('wide', 'tour-mode');
  stop.classList.add('wide');
  bar.replaceChildren(
    back,
    pause,
    next,
    el('div', { className: 'tour-status' }, label, track),
    ...tools,
    mode,
    stop,
  );
  bar.hidden = true;

  function setAutomatic(on: boolean): void {
    automatic = on;
    mode.textContent = on ? 'Auto' : 'Manual';
    const title = on
      ? 'Steps follow on by themselves: click to step by hand'
      : 'Stepping by hand: click to let the steps follow on by themselves';
    mode.title = title;
    mode.setAttribute('aria-label', title);
    mode.setAttribute('aria-pressed', String(on));
    bar.classList.toggle('is-manual', !on);
    // A scene that has already run its time moves on as soon as it may.
    if (on && finished && !paused) go(index + 1);
  }
  setAutomatic(true);

  /** The scene shown has run its time: on to the next one, unless stepping by hand. */
  const timeUp = (): void => {
    timer = undefined;
    finished = true;
    if (automatic) go(index + 1);
  };

  const clearTimers = (): void => {
    window.clearTimeout(timer);
    timer = undefined;
    for (const id of sceneTimers) window.clearTimeout(id);
    sceneTimers = [];
  };

  const schedule = (seconds: number): void => {
    window.clearTimeout(timer);
    remaining = seconds * 1000;
    deadline = performance.now() + remaining;
    timer = window.setTimeout(timeUp, remaining);
  };

  const renderTrack = (seconds: number | null): void => {
    track.replaceChildren(
      ...scenes.map((_, position) => {
        const segment = el('span', { className: 'tour-segment' });
        if (position < index) segment.classList.add('done');
        if (position === index) {
          segment.classList.add('current');
          const fill = el('span', { className: 'tour-fill' });
          if (seconds !== null) fill.style.animationDuration = `${seconds}s`;
          else fill.classList.add(scenes[position]?.pause ? 'waiting' : 'full');
          segment.append(fill);
        }
        return segment;
      }),
    );
  };

  const go = (target: number): void => {
    if (scenes.length === 0) return;
    const clamped = Math.max(0, Math.min(target, scenes.length - 1));
    if (clamped === index && target !== index) return;
    clearTimers();
    scenes[index]?.leave?.();
    index = clamped;
    paused = false;
    finished = false;
    pause.textContent = 'Pause';
    bar.classList.remove('is-paused');

    const scene = scenes[index]!;
    const sceneIndex = index;
    let retimed = false;
    label.textContent = `${index + 1} / ${scenes.length} · ${scene.title}`;
    back.disabled = index === 0;
    next.disabled = index === scenes.length - 1;
    const controls: SceneControls = {
      later(work, seconds) {
        sceneTimers.push(window.setTimeout(work, seconds * 1000));
      },
      retime(seconds) {
        if (index !== sceneIndex) return;
        retimed = true;
        renderTrack(seconds);
        pause.disabled = false;
        if (paused) remaining = seconds * 1000;
        else schedule(seconds);
      },
    };
    const override = scene.enter(controls);
    // A scene that set its own time while starting (it arrived at once) keeps that time.
    if (retimed) return;
    const seconds = typeof override === 'number' ? override : scene.seconds;
    renderTrack(seconds);
    pause.disabled = seconds === null && !scene.pause;
    if (seconds !== null) schedule(seconds);
  };

  const hold = (): void => {
    const scene = scenes[index];
    if (timer === undefined && !scene?.pause) return;
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timer = undefined;
      remaining = Math.max(0, deadline - performance.now());
    } else {
      remaining = -1;
    }
    scene?.pause?.(true);
    paused = true;
    pause.textContent = 'Resume';
    bar.classList.add('is-paused');
  };

  const resume = (): void => {
    if (!paused) return;
    paused = false;
    pause.textContent = 'Pause';
    bar.classList.remove('is-paused');
    scenes[index]?.pause?.(false);
    // A scene paused while it was waiting (mid-walk) has no time left to run down.
    if (remaining < 0) return;
    if (finished) {
      if (automatic) go(index + 1);
      return;
    }
    deadline = performance.now() + remaining;
    timer = window.setTimeout(timeUp, remaining);
  };

  /** Stops the walk; `notify` reports it, which a restart does not. */
  const end = (notify = true): void => {
    if (index < 0) return;
    clearTimers();
    scenes[index]?.leave?.();
    scenes = [];
    index = -1;
    finished = false;
    bar.hidden = true;
    if (notify) onStop();
  };

  return {
    play(next, startAt = 0) {
      // Replacing a walk is not stopping one: the caller has already set up the new walk,
      // and its stop handler would undo that setup.
      end(false);
      scenes = next;
      bar.hidden = false;
      setAutomatic(true);
      go(startAt);
    },
    stop: () => end(),
    get playing() {
      return index >= 0;
    },
    get automatic() {
      return automatic;
    },
  };
}
