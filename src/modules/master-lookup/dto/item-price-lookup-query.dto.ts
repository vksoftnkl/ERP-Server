import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';
import { toOptionalTrimmedString } from 'src/common/dto/DtoTransforms';
import {
  OptionalQueryBoolean,
  OptionalTrimmedString,
  OptionalUuid,
  RequiredInteger,
  RequiredUuid,
} from 'src/common/dto/dtoDecorators';
import {
  DEFAULT_FREIGHT_TYPE,
  DEFAULT_LOADING_TYPE,
  FREIGHT_TYPES,
  LOADING_TYPES,
} from '../master-lookup.constants';
import { FreightType, LoadingType } from '../types/master-lookup-api.types';
/**
 * A voucher-level charge mode (`loading_type`, `freight_type`) as a closed set.
 * The value is lower-cased before matching so a screen sending `AUTO` is not
 * rejected, and the rejection message spells the allowed values out — the caller
 * cannot guess them from a bare "invalid value".
 */
const OptionalChargeMode = (field: string, values: readonly string[]) =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }) => toOptionalTrimmedString(value)?.toLowerCase()),
    IsIn(values, {
      message: `${field} must be one of: ${values.join(', ')}`,
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
  @OptionalChargeMode('loading_type', LOADING_TYPES)
  loading_type?: LoadingType;
  @ApiPropertyOptional({
    enum: FREIGHT_TYPES,
    default: DEFAULT_FREIGHT_TYPE,
    description:
      "Voucher-level freight mode the freight charge is resolved with. manual = nothing resolved (user types it in); item_basis = the item price row's own ipm_freight_charge. Omitted is manual. There is no auto: freight slabs are matched on distance, which this lookup is not given.",
  })
  @OptionalChargeMode('freight_type', FREIGHT_TYPES)
  freight_type?: FreightType;
  @ApiProperty({
    minimum: 1,
    maximum: 7,
    description: 'Price column to use: 1=A, 2=B, 3=C, 4=D, 5=MRP/max, 6=min, 7=cost',
  })
  @RequiredInteger(1, 7)
  price_level!: number;
}