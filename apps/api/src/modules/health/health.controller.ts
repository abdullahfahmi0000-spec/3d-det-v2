import { Controller, Get } from '@nestjs/common';

import { type HealthResponse, HealthResponseSchema } from '@3ddet/contracts';

@Controller('health')
export class HealthController {
  /**
   * Liveness only. It reports that the process is serving requests and deliberately does
   * not touch the database, so an orchestrator does not restart a healthy process because a
   * dependency is briefly unavailable. Readiness checks are added with the dependencies they
   * check.
   */
  @Get()
  check(): HealthResponse {
    return HealthResponseSchema.parse({ status: 'ok' });
  }
}
