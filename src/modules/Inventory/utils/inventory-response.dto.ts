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
