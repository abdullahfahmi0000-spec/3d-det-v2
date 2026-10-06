import { Module } from '@nestjs/common';

import { HealthModule } from './modules/health/health.module';
import { IdentityModule } from './modules/identity/identity.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { PeopleModule } from './modules/people/people.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { ProcessesModule } from './modules/processes/processes.module';
import { ScenariosModule } from './modules/scenarios/scenarios.module';
import { BprModule } from './modules/bpr/bpr.module';
import { DigitalTwinModule } from './modules/digital-twin/digital-twin.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AiModule } from './modules/ai/ai.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { SchoolModule } from './modules/school/school.module';
import { AuditModule } from './modules/audit/audit.module';

/**
 * Root module of the modular monolith. Each domain module owns its own tables and exposes
 * services; cross-module access goes through those services (docs/adr/ADR-004).
 */
@Module({
  imports: [
    HealthModule,
    IdentityModule,
    TenantModule,
    OrganizationModule,
    PeopleModule,
    JobsModule,
    TasksModule,
    ProcessesModule,
    ScenariosModule,
    BprModule,
    DigitalTwinModule,
    AnalyticsModule,
    AiModule,
    IntegrationsModule,
    SchoolModule,
    AuditModule,
  ],
})
export class AppModule {}
