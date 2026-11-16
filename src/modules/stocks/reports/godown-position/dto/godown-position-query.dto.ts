import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { OptionalQueryBoolean, OptionalUuid, RequiredUuid } from 'src/common/dto/dtoDecorators';
import {
  BEHIND_KINDS,
  POSITION_BUCKETS,
  POSITION_QTY_IN,
  type BehindKind,
  type PositionBucket,
  type PositionQtyIn,
} from '../types/godown-position.types';

/**
 * Delivery tracking plan §8.3 — the query keys of stock/reports/godown-position
 * (menu 306). Own DTOs, shared with no other route. A malformed key is the
 * house ValidationPipe's 400 VALIDATION_*; everything that needs the database
 * is a 422 from the service.
 */
const upper = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;
const lower = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
const trimmed = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Ids compare with the database's lower-case uuid text. */
const LowerCaseId = () => Transform(lower);

/** Company + branch: every route. */
export class GodownPositionScopeDto {
  @ApiProperty({ format: 'uuid', description: 'Any company (as the Stock Summary).' })
  @RequiredUuid()
  @LowerCaseId()
  companyId!: string;

  @ApiProperty({ format: 'uuid', description: 'One branch: branch_master.br_comp_id must be companyId.' })
  @RequiredUuid()
  @LowerCaseId()
  branchId!: string;

  @ApiPropertyOptional({
    enum: POSITION_QTY_IN,
    default: 'SELLING',
    description:
      "SELLING = each item's selling unit (iuc_is_default_unit, else the base unit; Q16), BASE = the base unit.",
  })
  @IsOptional()
  @Transform(upper)
  @IsIn(POSITION_QTY_IN)
  qtyIn?: PositionQtyIn;

  @ApiPropertyOptional({
    enum: POSITION_BUCKETS,
    default: 'SALEABLE',
    description: 'The stock bucket the figures count. ALL = every bucket.',
  })
  @IsOptional()
  @Transform(upper)
  @IsIn(POSITION_BUCKETS)
  bucket?: PositionBucket;
}

/** GET /stock/reports/godown-position — Show. */
export class GodownPositionQueryDto extends GodownPositionScopeDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'One godown of the branch (gdl_branch_id). Absent = all godowns of the branch.',
  })
  @OptionalUuid()
  @LowerCaseId()
  godownId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Item filter: the group and its subtree.' })
  @OptionalUuid()
  @LowerCaseId()
  groupId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Item filter: the brand and its subtree.' })
  @OptionalUuid()
  @LowerCaseId()
  brandId?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Only rows with goods to give (Billed not delivered ≠ 0).',
  })
  @OptionalQueryBoolean()
  onlyToGive?: boolean;

  @ApiPropertyOptional({
    default: true,
    description: 'Hide rows whose Owned, Billed not delivered, Reserved and Challan out are all 0.',
  })
  @OptionalQueryBoolean()
  hideZero?: boolean;

  @ApiPropertyOptional({
    maxLength: 100,
    description: 'Item code / name / barcode contains (any case).',
  })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  find?: string;
}

/** GET /stock/reports/godown-position/export — Show's keys (every row, no paging). */
export class GodownPositionExportDto extends GodownPositionQueryDto {}

/** GET /stock/reports/godown-position/behind — what is behind one row's figure. */
export class GodownPositionBehindDto extends GodownPositionScopeDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  @LowerCaseId()
  itemId!: string;

  @ApiProperty({ format: 'uuid', description: 'A godown of the branch.' })
  @RequiredUuid()
  @LowerCaseId()
  godownId!: string;

  @ApiProperty({
    enum: BEHIND_KINDS,
    description: 'BND = the open bill lines behind Billed not delivered; CHALLAN = the open challan lines.',
  })
  @Transform(upper)
  @IsIn(BEHIND_KINDS)
  kind!: BehindKind;
}
