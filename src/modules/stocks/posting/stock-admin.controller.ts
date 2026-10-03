import { Controller, Get, Post, Query, UseFilters, Version } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsUUID, Matches } from 'class-validator';
import { API_VERSION } from 'src/common/constants/api-version';
import { StockVoucherExceptionFilter } from '../stock-voucher/stock-voucher-exception.filter';
import { StockAdminService } from './stock-admin.service';
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
  @ApiOkResponse({ description: 'How many documents were walked and how many vouchers were written.' })
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
      message: data.length ? `${data.length} findings` : 'Every derived figure agrees with its source',
      data,
    };
  }
}
