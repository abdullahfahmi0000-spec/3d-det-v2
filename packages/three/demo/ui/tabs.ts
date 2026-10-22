export type TabId = 'order' | 'people' | 'process';

export interface Tabs {
  open(tab: TabId): void;
}

/** Wires the inspector's tab strip to its panels. */
export function createTabs(root: HTMLElement): Tabs {
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[data-tab]')];
  const panels = [...root.querySelectorAll<HTMLElement>('[data-panel]')];

  const open = (tab: TabId): void => {
    for (const button of tabs)
      button.setAttribute('aria-selected', String(button.dataset.tab === tab));
    for (const panel of panels) panel.hidden = panel.dataset.panel !== tab;
  };
  for (const button of tabs) {
    button.addEventListener('click', () => open(button.dataset.tab as TabId));
  }
  return { open };
}
