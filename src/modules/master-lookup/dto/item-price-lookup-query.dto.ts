import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';
import { toOptionalTrimmedString } from 'src/common/dto/DtoTransforms';
import {
  OptionalNumber,
  OptionalQueryBoolean,
  OptionalTrimmedString,
  OptionalUuid,
  RequiredInteger,
  RequiredUuid,
} from 'src/common/dto/dtoDecorators';
import {
  DEFAULT_LOADING_QTY,
  DEFAULT_LOADING_TYPE,
  LOADING_TYPES,
} from '../master-lookup.constants';
import { LoadingType } from '../types/master-lookup-api.types';
/**
 * `loading_type` as a closed set. The value is lower-cased before matching so a
 * screen sending `AUTO` is not rejected, and the rejection message spells the
 * allowed values out — the caller cannot guess them from a bare "invalid value".
 */
const OptionalLoadingType = () =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }) => toOptionalTrimmedString(value)?.toLowerCase()),
    IsIn(LOADING_TYPES, {
      message: `loading_type must be one of: ${LOADING_TYPES.join(', ')}`,
    }),
  );
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
    enum: LOADING_TYPES,
    default: DEFAULT_LOADING_TYPE,
    description:
      "Voucher-level loading mode the loading charge is resolved with. manual = nothing resolved (user types it in); item_basis = the item price row's own charge; auto = the weight slab in sale_loading_charges, which also requires company_id and branch_id. Omitted is manual.",
  })
  @OptionalLoadingType()
  loading_type?: LoadingType;
  @ApiPropertyOptional({
    minimum: 0,
    description:
      "Line weight the auto slab is matched on. Optional: without it the weight is derived from the resolved unit's iuc_uom_weight × qty. Ignored by manual and item_basis.",
  })
  @OptionalNumber(0)
  weight?: number;
  @ApiPropertyOptional({
    minimum: 0,
    default: DEFAULT_LOADING_QTY,
    description: 'Line quantity the derived weight is computed with. Defaults to 1.',
  })
  @OptionalNumber(0)
  qty?: number;
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