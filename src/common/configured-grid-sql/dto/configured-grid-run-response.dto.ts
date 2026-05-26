import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConfiguredGridStyleDto } from './configured-grid-style.dto';

export class ConfiguredGridRunMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 100 })
  total!: number;
}

export class ConfiguredGridRunDataDto {
  @ApiProperty({ description: 'Rows returned by the grid SQL query', type: [Object] })
  items!: Record<string, unknown>[];

  @ApiProperty({ type: ConfiguredGridRunMetaDto })
  meta!: ConfiguredGridRunMetaDto;

  @ApiPropertyOptional({ type: [ConfiguredGridStyleDto] })
  styles?: ConfiguredGridStyleDto[];
}

export class ConfiguredGridRunResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'Grid data fetched successfully' })
  message!: string;

  @ApiProperty({ type: ConfiguredGridRunDataDto })
  data!: ConfiguredGridRunDataDto;
}
