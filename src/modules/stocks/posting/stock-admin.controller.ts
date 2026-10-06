import { Controller, Get, Post, Query, UseFilters, Version } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID, Matches } from 'class-validator';
import { API_VERSION } from 'src/common/constants/api-version';
import { StockVoucherExceptionFilter } from '../stock-voucher/stock-voucher-exception.filter';
import { StockAdminService, type StockRebuildReport } from './stock-admin.service';
import type { StockBalanceFinding } from './stock-balance-assertion';

export class PostMissingVouchersQueryDto {
  @IsUUID('all')
  companyId!: string;

  @Matches(/^\d{4}-\d{4}$/, { message: 'accYear must be YYYY-YYYY' })
  accYear!: string;
}

export class BalanceAssertionQueryDto {
  @IsOptional()
  @IsUUID('all')
  companyId?: string;

  @IsOptional()
  @IsUUID('all')
  branchId?: string;

  @IsOptional()
  @IsUUID('all')
  itemId?: string;
}

export class RebuildCostsQueryDto extends BalanceAssertionQueryDto {
  /** true: run everything, report, roll back. Default false. */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  dryRun?: boolean;
}

/**
 * Two administrative routes over the stock engine. Neither is a screen.
 *
 *   POST /stock/admin/post-missing-vouchers   §1.9's go-live step: stock
 *        documents posted before stock → accounts landed have no voucher.
 *        Walks POSTED OPENING / PHYSICAL vouchers with no acc_voucher_header
 *        row for (STOCK, svh_id) and posts them. Idempotent: it reads first.
 *   GET  /stock/admin/balance-assertion       §5.1, on demand: every derived
 *        figure re-derived from its source and compared. Detect and report,
 *        never fix.
 *   POST /stock/admin/rebuild-costs           notes 92 §4: the one explicit
 *        repair — every derived figure (balances, each tracked lot's own cost,
 *        item totals, lot totals) re-derived from the ledger. dryRun=true
 *        reports what would move and rolls back. Idempotent.
 */
@ApiTags('Stock Admin')
@ApiBearerAuth('access-token')
@Controller('stock/admin')
@UseFilters(StockVoucherExceptionFilter)
export class StockAdminController {
  constructor(private readonly admin: StockAdminService) {}

  @Post('post-missing-vouchers')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Post the accounts voucher for every POSTED stock document that has none (PERPETUAL)',
    description:
      'Go-live step for stock → accounts. Reads first, so running it twice writes nothing the second time. Under PERIODIC it posts nothing.',
  })
  @ApiOkResponse({
    description: 'How many documents were walked and how many vouchers were written.',
  })
  async postMissingVouchers(@Query() query: PostMissingVouchersQueryDto) {
    const data = await this.admin.postMissingVouchers(query.companyId, query.accYear);
    return {
      success: true as const,
      message: `${data.posted} accounts vouchers written for ${data.walked} stock documents`,
      data,
    };
  }

  @Get('balance-assertion')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Compare every derived stock figure to its source — detect, never fix',
  })
  @ApiOkResponse({ description: 'The findings; an empty list is a clean book.' })
  async balanceAssertion(
    @Query() query: BalanceAssertionQueryDto,
  ): Promise<{ success: true; message: string; data: StockBalanceFinding[] }> {
    const data = await this.admin.assertBalances(query);
    return {
      success: true,
      message: data.length
        ? `${data.length} findings`
        : 'Every derived figure agrees with its source',
      data,
    };
  }

  @Post('rebuild-costs')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Re-derive every stock figure from the ledger: balances, each lot’s own cost, item totals, lot totals (notes 92)',
    description:
      'The one-off backfill of notes 92 §4 and the only correct repair of the derived tables. ' +
      'dryRun=true runs the whole rebuild, reports every item whose total moved and every tracked lot’s cost, then rolls back. ' +
      'The ledger is never written. A second real run reports nothing moved.',
  })
  @ApiOkResponse({
    description:
      'Rows written per phase, the items whose totals moved, the lot costs, and the balance assertion afterwards.',
  })
  async rebuildCosts(
    @Query() query: RebuildCostsQueryDto,
  ): Promise<{ success: true; message: string; data: StockRebuildReport }> {
    const { dryRun, ...scope } = query;
    const data = await this.admin.rebuildCosts(scope, dryRun ?? false);
    const moved = data.itemsMoved.length;
    return {
      success: true,
      message: `${data.dryRun ? 'DRY RUN — rolled back. ' : ''}${moved} item total${moved === 1 ? '' : 's'} moved; ${data.written.lotRates} lot cost rows and ${data.written.balances} balance rows ${data.dryRun ? 'would be' : 'were'} written`,
      data,
    };
  }
}
