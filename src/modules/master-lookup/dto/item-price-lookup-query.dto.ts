import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  OptionalQueryBoolean,
  OptionalTrimmedString,
  OptionalUuid,
  RequiredInteger,
  RequiredUuid,
} from 'src/common/dto/dtoDecorators';
export class ItemPriceLookupQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  item_id!: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  unit_id?: string;
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Scopes the company-driven values (GST applicability, negative-stock rule, stock). When omitted, the item is resolved without a company scope.',
  })
  @OptionalUuid()
  company_id?: string;
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Scopes the item and its price rows to a branch. When omitted, the item is resolved across all branches.',
  })
  @OptionalUuid()
  branch_id?: string;
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
    description: 'Regional name (legacy iregional). When true, returns item_name_ta, else the English name.',
  })
  @OptionalQueryBoolean()
  regional?: boolean;
  @ApiPropertyOptional({
    maxLength: 20,
    description:
      "Voucher-level loading type, returned as-is in loading_type. When omitted, loading_type falls back to 'Y' / 'N' from the item's item_allow_loading flag.",
  })
  @OptionalTrimmedString(20)
  loading_type?: string;
  @ApiPropertyOptional({
    maxLength: 20,
    description:
      "Voucher-level freight type, returned as-is in freight_type. When omitted, freight_type falls back to 'Y' / 'N' from the item's item_allow_freight flag.",
  })
  @OptionalTrimmedString(20)
  freight_type?: string;
  @ApiProperty({
    minimum: 1,
    maximum: 7,
    description: 'Price column to use: 1=A, 2=B, 3=C, 4=D, 5=MRP/max, 6=min, 7=cost',
  })
  @RequiredInteger(1, 7)
  price_level!: number;
}