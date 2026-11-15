import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import {
  OptionalQueryBoolean,
  RequiredInteger,
  RequiredUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';

/** GET /voucher-types/tree. */
export class VoucherTypeTreeQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiPropertyOptional({ default: false })
  @OptionalQueryBoolean()
  includeInactive?: boolean;
}

/** GET /voucher-types/get (house rule: companyId + branchId + accYear + id). */
export class VoucherTypeGetQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid', description: 'The branch the preview and counters are for.' })
  @RequiredUuid()
  branchId!: string;

  @ApiProperty({ example: '2026-2027' })
  @TrimmedString(9)
  @IsNotEmpty()
  accYear!: string;

  @ApiProperty()
  @RequiredInteger(1)
  vchrTypeId!: number;
}

/** POST /voucher-types/inactivate and /delete. */
export class VoucherTypeRefDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty()
  @RequiredInteger(1)
  vchrTypeId!: number;
}

/** POST /voucher-types/print-design-clone (Alt+C, decision 36). */
export class PrintDesignCloneDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({
    example: 'SALE_INVOICE',
    description: 'The design to copy: a live one, shared or of this company.',
  })
  @TrimmedString(40)
  @IsNotEmpty()
  fromPpoCode!: string;

  @ApiProperty({
    example: 'RETAIL_INVOICE',
    description: 'Upper-cased by the server; ^[A-Z][A-Z0-9_]*$, up to 40.',
  })
  @TrimmedString(40)
  @IsNotEmpty()
  @Matches(/^[A-Za-z][A-Za-z0-9_]*$/)
  ppoCode!: string;

  @ApiProperty({ maxLength: 120, example: 'Retail Invoice' })
  @IsString()
  @MaxLength(120)
  @IsNotEmpty()
  ppoName!: string;
}
