import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class AmendSaleOrderDto extends SaveSaleOrderDto {
  @ApiProperty({ format: 'uuid', description: 'Required on amend' })
  @RequiredUuid()
  declare soId: string;

  @ApiProperty({ description: 'The soRevisionNo the client loaded — the optimistic lock' })
  @RequiredInteger(1)
  baseRevision!: number;

  @ApiPropertyOptional({ maxLength: 250 })
  @TrimmedString(250)
  @IsNotEmpty()
  editRemark!: string;
}
