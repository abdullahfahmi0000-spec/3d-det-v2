/**
 * Queue names. Each queue has its own concurrency limit so that a slow job class -- a large
 * asset conversion, for instance -- cannot starve the others.
 */
export const QUEUES = {
  AI: 'ai',
  DOCUMENTS: 'documents',
  ASSETS: 'assets',
  IMPORT_EXPORT: 'import-export',
  CALCULATIONS: 'calculations',
  INTEGRATIONS: 'integrations',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
