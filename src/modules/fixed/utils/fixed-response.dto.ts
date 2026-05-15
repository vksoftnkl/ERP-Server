import { ApiProperty } from '@nestjs/swagger';

export class FixedErrorFieldDto {
  @ApiProperty({ example: 'fieldName' })
  field!: string;

  @ApiProperty({ example: 'Validation message' })
  message!: string;
}

export class FixedErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: FixedErrorFieldDto, isArray: true })
  errors!: FixedErrorFieldDto[];
}

export class FixedListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  total_pages!: number;
}
