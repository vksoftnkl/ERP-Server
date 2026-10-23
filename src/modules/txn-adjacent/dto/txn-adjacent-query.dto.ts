import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, Matches } from 'class-validator';
import { OptionalTrimmedString, OptionalUuid, RequiredUuid } from 'src/common/dto/dtoDecorators';
import { TXN_DOC_TYPES, type TxnDocType } from '../txn-adjacent.registry';

/**
 * Notes 142 — `GET /txn/adjacent`: the document on screen, a direction, and
 * the list's own filters, so the walk visits exactly the rows the list shows.
 * `docId` may be omitted on an EMPTY screen: prev then answers the newest
 * document under the filters, next the oldest.
 */
export class TxnAdjacentQueryDto {
  @ApiProperty({ enum: TXN_DOC_TYPES, example: 'OPENING_STOCK' })
  @IsIn(TXN_DOC_TYPES)
  docType!: TxnDocType;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  branchId!: string;

  @ApiProperty({ example: '2026-2027', description: 'The year — the partition the walk stays in.' })
  @Matches(/^\d{4}-\d{4}$/)
  accYear!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'The document on screen. Omit on an empty screen: prev → the newest document, next → the oldest.',
  })
  @OptionalUuid()
  docId?: string;

  @ApiProperty({
    enum: ['prev', 'next'],
    description: 'prev = the document entered just BEFORE this one (older); next = just after.',
  })
  @IsIn(['prev', 'next'])
  direction!: 'prev' | 'next';

  @ApiPropertyOptional({
    example: 'ISSUE',
    description:
      'Walk one type only. VOUCHER: a register voucher type code (Jrl, Con, RcpV …), as ' +
      '/vouchers/adjacent. STOCK_ADJUSTMENT: ADJUSTMENT | ISSUE | DAMAGE | EXPIRY_WRITEOFF. ' +
      'A sales document: its `*_doc_type` (TAX_INVOICE …). Omit to walk every type the list shows.',
  })
  @OptionalTrimmedString(20)
  typeCode?: string;

  @ApiPropertyOptional({
    example: 'POSTED',
    description: "The list's status filter, if set — one of the docType's own statuses.",
  })
  @OptionalTrimmedString(20)
  status?: string;

  @ApiPropertyOptional({ example: '2026-09-01', description: "The list's from-date, if set." })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fromDate?: string;

  @ApiPropertyOptional({ example: '2026-09-30', description: "The list's to-date, if set." })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  toDate?: string;
}
