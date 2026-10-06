import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { loadConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const config = loadConfig(process.env);
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  app.enableCors({ origin: config.corsOrigin, credentials: true });
  app.enableShutdownHooks();

  await app.listen(config.port);
  console.info(`API listening on port ${config.port}`);
}

bootstrap().catch((error: unknown) => {
  console.error('API failed to start', error);
  process.exit(1);
});
