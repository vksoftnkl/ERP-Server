import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { RequiredInteger, RequiredUuid, TrimmedString } from 'src/common/dto/dtoDecorators';
import { SaveSaleOrderDto } from './save-sale-order.dto';

/** HANDOVER §3 — the four keys of an existing order. */
export class SaleOrderKeysDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  soId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  soCompanyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  soBranchId!: string;

  @ApiProperty({ minLength: 9, maxLength: 9, example: '2026-2027' })
  @TrimmedString(9)
  @IsNotEmpty()
  soAccYear!: string;
}

export class PostSaleOrderDto extends SaleOrderKeysDto {}

export class CancelSaleOrderDto extends SaleOrderKeysDto {
  @ApiProperty({ maxLength: 250 })
  @TrimmedString(250)
  @IsNotEmpty()
  reason!: string;
}

/**
 * The full create body, but soId is REQUIRED: an amend names the order it edits.
 * soId is OMITTED from the base and declared fresh rather than narrowed with
 * `declare`, which drops the decorators (no validation, no Swagger `required`)
 * and left the base's IsOptional in force, so a missing soId got through.
 * OmitType copies every other property's validators, transforms and docs.
 */
export class AmendSaleOrderDto extends OmitType(SaveSaleOrderDto, ['soId'] as const) {
  @ApiProperty({ format: 'uuid', description: 'The order being amended. Required on amend' })
  @RequiredUuid()
  soId!: string;

  @ApiProperty({ description: 'The soRevisionNo the client loaded — the optimistic lock' })
  @RequiredInteger(1)
  baseRevision!: number;

  @ApiPropertyOptional({ maxLength: 250 })
  @TrimmedString(250)
  @IsNotEmpty()
  editRemark!: string;
}
