import { ApiProperty } from '@nestjs/swagger';

export class ModuleErrorFieldDto {
  @ApiProperty({ example: 'fieldName' })
  field!: string;

  @ApiProperty({ example: 'Validation message' })
  message!: string;
}

export class ModuleErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: ModuleErrorFieldDto, isArray: true })
  errors!: ModuleErrorFieldDto[];
}

export class ModuleListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  total_pages!: number;
}

export {
  ModuleErrorFieldDto as AccountsErrorFieldDto,
  ModuleErrorFieldDto as FixedErrorFieldDto,
  ModuleErrorFieldDto as InventoryErrorFieldDto,
  ModuleErrorFieldDto as PurchaseErrorFieldDto,
  ModuleErrorFieldDto as SalesErrorFieldDto,
  ModuleErrorResponseDto as AccountsErrorResponseDto,
  ModuleErrorResponseDto as FixedErrorResponseDto,
  ModuleErrorResponseDto as InventoryErrorResponseDto,
  ModuleErrorResponseDto as PurchaseErrorResponseDto,
  ModuleErrorResponseDto as SalesErrorResponseDto,
  ModuleListMetaDto as AccountsListMetaDto,
  ModuleListMetaDto as FixedListMetaDto,
  ModuleListMetaDto as InventoryListMetaDto,
  ModuleListMetaDto as PurchaseListMetaDto,
  ModuleListMetaDto as SalesListMetaDto,
};
