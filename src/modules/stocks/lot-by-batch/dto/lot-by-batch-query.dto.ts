import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional } from 'class-validator';
import {
  OptionalQueryBoolean,
  OptionalUuid,
  RequiredUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';
import { STOCK_BUCKETS, type StockBucket } from '../../stock-voucher/types/stock-voucher.types';

/** `bucket` on the scan: one bucket, or every bucket at once. */
export const LOT_BY_BATCH_BUCKETS = [...STOCK_BUCKETS, 'ALL'] as const;
export type LotByBatchBucket = StockBucket | 'ALL';

export class LotByBatchQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid', description: 'The branch whose stock is counted.' })
  @RequiredUuid()
  branchId!: string;

  @ApiProperty({
    example: 'CBE26-00001',
    description: 'What the scanner read. Matched as the lot key folds it: trimmed, upper-cased.',
  })
  @TrimmedString(100)
  @IsNotEmpty()
  batchNo!: string;

  @ApiPropertyOptional({
    default: false,
    description: 'true: also the lots with no stock (in the bucket asked for) at this branch.',
  })
  @OptionalQueryBoolean()
  includeEmpty?: boolean;

  @ApiPropertyOptional({
    enum: LOT_BY_BATCH_BUCKETS,
    default: 'SALEABLE',
    description:
      "Notes 150 #10 — which bucket the holdings are counted in. SALEABLE (the sale's default), one other bucket, or ALL: every bucket, each godown row then naming its bucket. The count screen scans with ALL.",
  })
  @IsOptional()
  @IsIn(LOT_BY_BATCH_BUCKETS as unknown as string[], {
    message: `bucket must be one of ${LOT_BY_BATCH_BUCKETS.join(', ')}`,
  })
  bucket?: LotByBatchBucket;

  @ApiPropertyOptional({
    format: 'uuid',
    description: "Notes 150 #10 — only this godown's holdings; the lot list is unchanged.",
  })
  @OptionalUuid()
  godownId?: string;
}
