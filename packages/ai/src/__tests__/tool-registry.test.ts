import { describe, expect, it } from 'vitest';

import { ToolRegistry } from '../tools/tool-registry';

const readTool = {
  descriptor: {
    name: 'organization.read_node',
    description: 'Read a node.',
    resourceType: 'NODE',
    action: 'READ' as const,
    mutating: false,
  },
  handler: async () => ({}),
};

const writeTool = {
  descriptor: {
    name: 'organization.propose_node_change',
    description: 'Propose a change to a node.',
    resourceType: 'NODE',
    action: 'UPDATE' as const,
    mutating: true,
  },
  handler: async () => ({}),
};

describe('ToolRegistry', () => {
  it('separates mutating tools from read tools', () => {
    const registry = new ToolRegistry();
    registry.register(readTool);
    registry.register(writeTool);

    expect(registry.descriptors()).toHaveLength(2);
    expect(registry.mutatingToolNames()).toEqual(['organization.propose_node_change']);
  });

  it('refuses a duplicate tool name', () => {
    const registry = new ToolRegistry();
    registry.register(readTool);
    expect(() => registry.register(readTool)).toThrow(/already registered/);
  });
});
