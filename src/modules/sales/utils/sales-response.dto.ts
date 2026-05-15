import { ApiProperty } from '@nestjs/swagger';

export class SalesErrorFieldDto {
  @ApiProperty({ example: 'fieldName' })
  field!: string;

  @ApiProperty({ example: 'Validation message' })
  message!: string;
}

export class SalesErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: SalesErrorFieldDto, isArray: true })
  errors!: SalesErrorFieldDto[];
}

export class SalesListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  total_pages!: number;
}
