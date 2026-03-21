import { ApiProperty } from '@nestjs/swagger';

export class HealthDatabaseStatusDto {
  @ApiProperty({ enum: ['up', 'down'], example: 'up' })
  status!: 'up' | 'down';
}

export class HealthResponseDto {
  @ApiProperty({ enum: ['ok', 'degraded'], example: 'ok' })
  status!: 'ok' | 'degraded';

  @ApiProperty({ example: '2026-02-12T14:32:10.123Z' })
  timestamp!: string;

  @ApiProperty({ type: HealthDatabaseStatusDto })
  database!: HealthDatabaseStatusDto;
}
