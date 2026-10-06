import { Module } from '@nestjs/common';

/**
 * Spatial data and view models served to the 3D viewer.
 *
 * Module boundary only. Controllers, services and queries are added as this capability is
 * specified. Other modules reach this one through its exported services, never through its
 * tables.
 */
@Module({})
export class DigitalTwinModule {}
