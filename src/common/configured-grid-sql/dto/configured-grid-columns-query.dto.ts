import { ApiProperty } from '@nestjs/swagger';
import { IsNumberString } from 'class-validator';

export class ConfiguredGridColumnsQueryDto {
  @ApiProperty({ description: 'Numeric grid id', example: '1' })
  @IsNumberString({ no_symbols: true })
  grid_id!: string;
}
