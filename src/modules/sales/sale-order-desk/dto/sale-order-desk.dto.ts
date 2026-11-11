import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import {
  NullableUuid,
  OptionalTrimmedString,
  RequiredUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';
import { SaleOrderKeysDto } from '../../sale-order/dto/sale-order-lifecycle.dto';
import {
  SALE_ORDER_DESK_COVER_MAX,
  SALE_ORDER_DESK_FIGURES_MAX,
  SALE_ORDER_DESK_MERGE_MAX,
  SALE_ORDER_DESK_PRIORITIES,
} from '../types/sale-order-desk.types';

/**
 * Sales Order Management (menu 299) — the desk's request bodies. The order
 * keys are the lifecycle's `SaleOrderKeysDto` (soId, soCompanyId, soBranchId,
 * soAccYear), unchanged.
 *
 * A reason is declared optional on purpose: a blank or missing one is refused
 * by the service as 400 SALES_ORDER_REASON_REQUIRED (worded "Reason needed"),
 * not as a generic validation error.
 */
export class DeliveryHoldDto extends SaleOrderKeysDto {
  @ApiProperty({ description: 'The state wanted: true = put on delivery hold, false = release' })
  @IsBoolean()
  soDeliveryHold!: boolean;

  @ApiPropertyOptional({
    maxLength: 250,
    description: 'Why — required both ways (400 SALES_ORDER_REASON_REQUIRED when blank)',
  })
  @OptionalTrimmedString(250)
  reason?: string;
}

export class PriorityDto extends SaleOrderKeysDto {
  @ApiProperty({
    enum: SALE_ORDER_DESK_PRIORITIES,
    description: 'The priority wanted (ck_so_priority). The desk sends URGENT (quick) or NORMAL',
  })
  @IsIn([...SALE_ORDER_DESK_PRIORITIES])
  soPriority!: string;
}

export class CloseOpenLinesDto extends SaleOrderKeysDto {
  @ApiPropertyOptional({
    maxLength: 250,
    description: 'Why the rest is not wanted (400 SALES_ORDER_REASON_REQUIRED when blank)',
  })
  @OptionalTrimmedString(250)
  reason?: string;
}

/** One order, by its two primary-key halves. */
export class SaleOrderDeskOrderRefDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  soId!: string;

  @ApiProperty({ minLength: 9, maxLength: 9, example: '2026-2027' })
  @TrimmedString(9)
  @IsNotEmpty()
  soAccYear!: string;
}

class SaleOrderDeskScopeDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  soCompanyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  soBranchId!: string;
}

export class StockCoverDto extends SaleOrderDeskScopeDto {
  @ApiProperty({ type: SaleOrderDeskOrderRefDto, isArray: true, minItems: 1, maxItems: 500 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(SALE_ORDER_DESK_COVER_MAX)
  @ValidateNested({ each: true })
  @Type(() => SaleOrderDeskOrderRefDto)
  orders!: SaleOrderDeskOrderRefDto[];

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: "The desk's item filter, or null for every item",
  })
  @NullableUuid()
  itemId?: string | null;
}

export class FiguresDto extends SaleOrderDeskScopeDto {
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'openValue counts this item only; orderOpenValue is always the whole order',
  })
  @NullableUuid()
  itemId?: string | null;

  @ApiProperty({ type: SaleOrderDeskOrderRefDto, isArray: true, maxItems: 2000 })
  @IsArray()
  @ArrayMaxSize(SALE_ORDER_DESK_FIGURES_MAX)
  @ValidateNested({ each: true })
  @Type(() => SaleOrderDeskOrderRefDto)
  orders!: SaleOrderDeskOrderRefDto[];

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    isArray: true,
    maxItems: 2000,
    description: "More customers to read dues for (e.g. the strip's current customer)",
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(SALE_ORDER_DESK_FIGURES_MAX)
  @IsUUID('all', { each: true })
  custIds?: string[];
}

export class MergePreviewDto extends SaleOrderDeskScopeDto {
  @ApiProperty({
    type: SaleOrderDeskOrderRefDto,
    isArray: true,
    maxItems: 20,
    description: 'The orders to merge (fewer than 2 distinct → refusal SALES_ORDER_MERGE_TOO_FEW)',
  })
  @IsArray()
  @ArrayMaxSize(SALE_ORDER_DESK_MERGE_MAX)
  @ValidateNested({ each: true })
  @Type(() => SaleOrderDeskOrderRefDto)
  orders!: SaleOrderDeskOrderRefDto[];
}

export class MergeDto extends MergePreviewDto {
  @ApiProperty({
    minLength: 9,
    maxLength: 9,
    example: '2026-2027',
    description: "The NEW order's year",
  })
  @TrimmedString(9)
  @IsNotEmpty()
  soAccYear!: string;

  @ApiProperty({
    format: 'uuid',
    description:
      "fixed.device_master.dev_id — the session's registered device; numbers the new order",
  })
  @RequiredUuid()
  soDeviceId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  soSessionId?: string | null;

  @ApiProperty({
    description: 'The fingerprint merge-preview answered (409 SOURCE_CHANGED if stale)',
  })
  @TrimmedString(64)
  @IsNotEmpty()
  fingerprint!: string;

  @ApiPropertyOptional({ maxLength: 250, description: "Default 'Merged on the order desk'" })
  @OptionalTrimmedString(250)
  reason?: string;
}
