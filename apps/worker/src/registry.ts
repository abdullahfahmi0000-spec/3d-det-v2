import { QUEUES, type QueueName } from './queues';

export type JobHandler = (data: unknown) => Promise<void>;

/**
 * Maps queues to handlers. Building the registry opens no connection, so it can be tested
 * without Redis. No handlers are registered at bootstrap: each is added with the capability
 * that needs it.
 */
export class HandlerRegistry {
  private readonly handlers = new Map<QueueName, JobHandler>();

  register(queue: QueueName, handler: JobHandler): void {
    if (this.handlers.has(queue)) {
      throw new Error(`handler already registered for queue: ${queue}`);
    }
    this.handlers.set(queue, handler);
  }

  handlerFor(queue: QueueName): JobHandler | undefined {
    return this.handlers.get(queue);
  }

  registeredQueues(): readonly QueueName[] {
    return [...this.handlers.keys()];
  }
}

export const ALL_QUEUES: readonly QueueName[] = Object.values(QUEUES);
