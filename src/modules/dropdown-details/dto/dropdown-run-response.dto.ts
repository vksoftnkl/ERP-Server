import { ApiProperty } from '@nestjs/swagger';

export class DropdownRunMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 100 })
  total!: number;
}

export class DropdownRunDataDto {
  @ApiProperty({ description: 'Rows returned by the dropdown SQL query', type: [Object] })
  items!: Record<string, unknown>[];

  @ApiProperty({ type: DropdownRunMetaDto })
  meta!: DropdownRunMetaDto;
}

export class DropdownRunResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'Dropdown data fetched successfully' })
  message!: string;

  @ApiProperty({ type: DropdownRunDataDto })
  data!: DropdownRunDataDto;
}
