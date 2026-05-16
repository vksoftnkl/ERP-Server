import { ApiProperty } from '@nestjs/swagger';
export class InventoryErrorFieldDto {
  @ApiProperty({ example: 'fieldName' })
  field!: string;
  @ApiProperty({ example: 'Validation message' })
  message!: string;
}
export class InventoryErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;
  @ApiProperty({ example: 'Validation failed' })
  message!: string;
  @ApiProperty({ type: InventoryErrorFieldDto, isArray: true })
  errors!: InventoryErrorFieldDto[];
}
export class InventoryListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;
  @ApiProperty({ example: 20 })
  limit!: number;
  @ApiProperty({ example: 3 })
  total!: number;
  @ApiProperty({ example: 1 })
  total_pages!: number;
}
