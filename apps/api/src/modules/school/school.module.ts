import { Module } from '@nestjs/common';

/**
 * Education workspaces and learning-platform interoperability.
 *
 * Module boundary only. Controllers, services and queries are added as this capability is
 * specified. Other modules reach this one through its exported services, never through its
 * tables.
 */
@Module({})
export class SchoolModule {}
