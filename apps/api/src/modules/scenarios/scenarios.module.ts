import { Module } from '@nestjs/common';

/**
 * Scenario lifecycle, comparison and promotion.
 *
 * Module boundary only. Controllers, services and queries are added as this capability is
 * specified. Other modules reach this one through its exported services, never through its
 * tables.
 */
@Module({})
export class ScenariosModule {}
