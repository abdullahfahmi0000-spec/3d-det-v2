import 'reflect-metadata';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { HealthResponseSchema } from '@3ddet/contracts';

import { AppModule } from '../src/app.module';

describe('GET /health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the shared health contract', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);
    expect(HealthResponseSchema.parse(response.body)).toEqual({ status: 'ok' });
  });
});
