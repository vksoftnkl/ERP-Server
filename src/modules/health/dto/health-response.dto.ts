import { ApiProperty } from '@nestjs/swagger';
export class HealthDatabaseStatusDto {
  @ApiProperty({ enum: ['up', 'down'], example: 'up' })
  status!: 'up' | 'down';
}
export class HealthCacheStatusDto {
  @ApiProperty({ enum: ['up', 'down', 'disabled'], example: 'up' })
  status!: 'up' | 'down' | 'disabled';
}
export class HealthResponseDto {
  @ApiProperty({ enum: ['ok', 'degraded'], example: 'ok' })
  status!: 'ok' | 'degraded';
  @ApiProperty({ example: '2026-02-12T14:32:10.123Z' })
  timestamp!: string;
  @ApiProperty({ example: '1.2.0', description: 'APP_VERSION, else package.json version' })
  version!: string;
  @ApiProperty({ example: 57, nullable: true, description: 'APP_BUILD (set by CI)' })
  build!: number | null;
  @ApiProperty({ example: 'aa10be0d', nullable: true, description: 'APP_COMMIT (set by CI)' })
  commit!: string | null;
  @ApiProperty({ example: true, description: 'The database answered SELECT 1' })
  dbOk!: boolean;
  @ApiProperty({ type: HealthDatabaseStatusDto })
  database!: HealthDatabaseStatusDto;
  @ApiProperty({ type: HealthCacheStatusDto })
  cache!: HealthCacheStatusDto;
}
