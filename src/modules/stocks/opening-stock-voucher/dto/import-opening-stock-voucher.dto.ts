import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Matches } from 'class-validator';
import { OptionalUuid, RequiredUuid, TrimmedString } from 'src/common/dto/dtoDecorators';

const ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;

/**
 * The multipart body of `POST /stock/opening/import`. The CSV itself arrives as
 * the `file` part; these are the form fields alongside it.
 *
 * `svhId` is REQUIRED: an import replaces the lines of a DRAFT that already
 * exists, it never creates the document. The header — the godown, the date, the
 * rate source, the device the number came from — is the operator's decision and
 * is not something a spreadsheet gets to make.
 */
export class ImportOpeningStockVoucherDto {
  @ApiProperty({
    format: 'uuid',
    description: 'The existing DRAFT whose lines are being replaced.',
  })
  @RequiredUuid()
  svhId!: string;

  @ApiProperty({ example: '2026-2027', minLength: 9, maxLength: 9 })
  @TrimmedString(9)
  @Matches(ACC_YEAR_PATTERN, { message: 'accYear must be YYYY-YYYY, e.g. 2026-2027' })
  accYear!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  branchId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Falls back to the authenticated user from the request context.',
  })
  @OptionalUuid()
  userId?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description:
      'CSV. Required columns: item_code, unit_name, qty, cost_rate. Optional: line_no, split_no, godown, bucket, batch_no, mfg_date, expiry_date, mrp, sale_price, serial_no, supplier_code, free_qty, cost_rate_wot, tax_perc, remarks.',
  })
  file?: unknown;
}
