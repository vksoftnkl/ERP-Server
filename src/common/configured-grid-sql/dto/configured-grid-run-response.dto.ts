import { ApiProperty } from '@nestjs/swagger';

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
}

export class ConfiguredGridRunResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'Grid data fetched successfully' })
  message!: string;

  @ApiProperty({ type: ConfiguredGridRunDataDto })
  data!: ConfiguredGridRunDataDto;
}
