import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  OptionalQueryBoolean,
  OptionalTrimmedString,
  OptionalUuid,
  RequiredInteger,
  RequiredUuid,
} from 'src/common/dto/dtoDecorators';
export class GetItemPriceLookupQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  item_id!: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  unit_id?: string;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  company_id!: string;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  branch_id!: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  customer_id?: string;
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Sale godown override (legacy isale_no). When supplied, resolves the godown row and scopes stock to this godown instead of the rate\'s own godown.',
  })
  @OptionalUuid()
  godown_id?: string;
  @ApiPropertyOptional({ maxLength: 9, description: 'Accounting year, e.g. 2024-2025' })
  @OptionalTrimmedString(9)
  acccyear?: string;
  @ApiPropertyOptional({
    description:
      'Loading mode (legacy ienable_loading). When true, stock is summed across ALL godowns; when false/absent it is scoped to the resolved godown.',
  })
  @OptionalQueryBoolean()
  enable_loading?: boolean;
  @ApiPropertyOptional({
    description: 'Regional name (legacy iregional). When true, returns item_name_ta, else the English name.',
  })
  @OptionalQueryBoolean()
  regional?: boolean;
  @ApiProperty({
    minimum: 1,
    maximum: 7,
    description: 'Price column to use: 1=A, 2=B, 3=C, 4=D, 5=MRP/max, 6=min, 7=cost',
  })
  @RequiredInteger(1, 7)
  price_level!: number;
}
