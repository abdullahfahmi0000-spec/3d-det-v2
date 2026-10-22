type Child = Node | string | null | undefined | false;

export interface ElementProps {
  readonly className?: string;
  readonly text?: string;
  readonly dataset?: Readonly<Record<string, string>>;
  readonly attributes?: Readonly<Record<string, string>>;
}

/** Creates an element with optional class, text, data attributes and children. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElementProps = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (props.className) element.className = props.className;
  if (props.text !== undefined) element.textContent = props.text;
  Object.assign(element.dataset, props.dataset);
  for (const [name, value] of Object.entries(props.attributes ?? {})) {
    element.setAttribute(name, value);
  }
  for (const child of children) {
    if (child) element.append(child);
  }
  return element;
}

/** Looks up an element the page markup is expected to contain. */
export function requireElement<T extends HTMLElement>(id: string, type: new () => T): T {
  const element = document.getElementById(id);
  if (!(element instanceof type)) throw new Error(`Missing #${id} element`);
  return element;
}

/** A two-column list of label/value rows. */
export function detailList(rows: readonly (readonly [string, Child])[]): HTMLDListElement {
  return el(
    'dl',
    { className: 'detail-list' },
    ...rows.flatMap(([label, value]) => [el('dt', { text: label }), el('dd', {}, value)]),
  );
}
