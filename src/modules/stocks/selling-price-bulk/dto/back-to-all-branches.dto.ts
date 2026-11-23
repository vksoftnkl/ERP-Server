import { ApiProperty } from '@nestjs/swagger';
import { RequiredUuid } from 'src/common/dto/dtoDecorators';

/**
 * Change Selling Price P1 (plan 2026-11-23 §4.9 / §7.3) — Back to all branches · Alt+X:
 * a store's own price line, and its later scheduled rows of the same key, are removed so
 * the store reads the All branches price again.
 */
export class BackToAllBranchesDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'The branch whose own line goes. A store user: his own branch only (else 403 ' +
      'STOCK_PRICE_BRANCH_HQ_ONLY); head office: any branch.',
  })
  @RequiredUuid()
  branchId!: string;

  @ApiProperty({
    format: 'uuid',
    description:
      "The own line's ipm_id as loaded (GET /stock/price-bulk bucketId). A line the item card " +
      'rewrote since (soft-deleted, same key) is found again by its key.',
  })
  @RequiredUuid()
  ipmId!: string;
}
