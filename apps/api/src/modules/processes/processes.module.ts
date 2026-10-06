import { Module } from '@nestjs/common';

/**
 * Process models and process notation.
 *
 * Module boundary only. Controllers, services and queries are added as this capability is
 * specified. Other modules reach this one through its exported services, never through its
 * tables.
 */
@Module({})
export class ProcessesModule {}
