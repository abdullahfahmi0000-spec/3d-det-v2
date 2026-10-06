import { Worker } from 'bullmq';

import { ALL_QUEUES, HandlerRegistry } from './registry';

/**
 * Worker entry point. Connects to Redis and starts one BullMQ worker per queue that has a
 * registered handler. Nothing is registered at bootstrap, so the process starts, reports
 * that it has no work, and stays up waiting for handlers to be added.
 */
async function main(): Promise<void> {
  const connection = {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number.parseInt(process.env.REDIS_PORT ?? '6379', 10),
  };

  const registry = new HandlerRegistry();
  const workers = registry.registeredQueues().map(
    (queue) =>
      new Worker(
        queue,
        async (job) => {
          const handler = registry.handlerFor(queue);
          if (handler === undefined) throw new Error(`no handler for queue ${queue}`);
          await handler(job.data);
        },
        { connection },
      ),
  );

  console.info(`worker started: ${workers.length} of ${ALL_QUEUES.length} queues have handlers`);

  const shutdown = async (): Promise<void> => {
    await Promise.all(workers.map((worker) => worker.close()));
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((error: unknown) => {
  console.error('worker failed to start', error);
  process.exit(1);
});
