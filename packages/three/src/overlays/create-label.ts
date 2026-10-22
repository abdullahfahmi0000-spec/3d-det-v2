import type { Object3D } from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

import type { LabelTone } from '../viewer-contract/twin-model';

export type LabelVariant =
  | 'company'
  | 'building'
  | 'zone'
  | 'room'
  | 'person'
  | 'stop'
  | 'badge'
  | 'truck'
  | 'dock'
  | 'callout'
  | 'floor-tag';

export interface LabelContent {
  readonly variant: LabelVariant;
  readonly title: string;
  readonly lines?: readonly string[];
  /** A short monospace line, such as a code or a KPI summary. */
  readonly detail?: string;
  /** Status colour of the label's indicator. */
  readonly tone?: LabelTone;
  /** Text in a small leading badge, such as a step number. */
  readonly marker?: string;
}

/**
 * When a label is shown: `always`; only when its floor is opened up on its own (`floor`);
 * when the camera is near or the floor is opened up (`near`); or only when the floor is
 * opened up and the camera is close (`close`); only in the site overview, from afar
 * (`overview`); or only in the plan view, on the floor shown (`plan`).
 */
export type LabelReveal = 'always' | 'floor' | 'near' | 'close' | 'overview' | 'plan';

/** A line added under a label's own content, such as the process step done at a desk. */
export interface LabelNote {
  readonly marker: string;
  readonly title: string;
  readonly subtitle: string;
  /** Written to `data-state`, so the host page can colour it. */
  readonly state: string;
}

/** Replaces the notes shown under a label; an empty list removes them. */
export function setLabelNotes(label: CSS2DObject, notes: readonly LabelNote[]): void {
  label.element.querySelector('.twin-label__notes')?.remove();
  label.element.classList.toggle('has-notes', notes.length > 0);
  if (notes.length === 0) return;

  const list = document.createElement('div');
  list.className = 'twin-label__notes';
  for (const note of notes) {
    const row = document.createElement('div');
    row.className = 'twin-label__note';
    row.dataset.state = note.state;
    row.append(textElement('span', 'twin-label__marker', note.marker));
    const text = document.createElement('div');
    text.className = 'twin-label__note-text';
    text.append(textElement('strong', 'twin-label__note-title', note.title));
    if (note.subtitle) text.append(textElement('span', 'twin-label__line', note.subtitle));
    row.append(text);
    list.append(row);
  }
  label.element.append(list);
}

/**
 * Builds a screen-space label that follows a point in the scene.
 *
 * The viewer sets only class names (`twin-label`, `twin-label--<variant>`) and data
 * attributes (`data-tone`, `data-state`); the host page owns the styling, so labels match
 * its UI.
 */
export function createLabel(content: LabelContent): CSS2DObject {
  const label = new CSS2DObject(document.createElement('div'));
  label.name = `label:${content.title}`;
  label.center.set(0.5, 1);
  updateLabel(label, content);
  return label;
}

/** Rewrites the content of an existing label. */
export function updateLabel(label: CSS2DObject, content: LabelContent): void {
  const element = label.element;
  element.className = `twin-label twin-label--${content.variant}`;
  if (content.tone) element.dataset.tone = content.tone;
  else delete element.dataset.tone;

  const children: HTMLElement[] = [];
  if (content.marker !== undefined) {
    children.push(textElement('span', 'twin-label__marker', content.marker));
  }
  const body = document.createElement('div');
  body.className = 'twin-label__body';
  body.append(textElement('strong', 'twin-label__title', content.title));
  for (const line of content.lines ?? []) {
    body.append(textElement('span', 'twin-label__line', line));
  }
  if (content.detail) body.append(textElement('code', 'twin-label__detail', content.detail));
  children.push(body);
  element.replaceChildren(...children);
}

function textElement(tag: string, className: string, text: string): HTMLElement {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

/**
 * Removes the DOM elements of every label under `root`. Three.js only detaches a label's
 * element when the label itself is removed, not when one of its ancestors is.
 */
export function detachLabels(root: Object3D): void {
  root.traverse((object) => {
    if (object instanceof CSS2DObject) object.element.remove();
  });
}

export const toCssColor = (hex: number): string => `#${hex.toString(16).padStart(6, '0')}`;
