import { Controller, Get, Query, Version } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { API_VERSION } from 'src/common/constants/api-version';
import { TxnStatusService, type PendingDocumentsResult } from './txn-status.service';

export class PendingTxnStatusQueryDto {
  @IsUUID('all')
  companyId!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Omit for every branch of the company.' })
  @IsOptional()
  @IsUUID('all')
  branchId?: string;

  @Matches(/^\d{4}-\d{4}$/, { message: 'accYear must be YYYY-YYYY' })
  accYear!: string;

  @ApiPropertyOptional({ example: '2026-09-28', description: 'Steps up to the end of this day. Defaults to now.' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'upToDate must be YYYY-MM-DD' })
  upToDate?: string;

  @ApiPropertyOptional({ example: 'SALES', description: 'SALES | PURCHASE | INVENTORY | ACCOUNTS | POS | SERVICE | OTHER' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  srcModule?: string;

  @ApiPropertyOptional({ default: 200, maximum: 2000 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(2000)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(0)
  offset?: number;
}

/**
 * §1.10 — the day-close screen's question, answered from `public.txn_status_log`.
 */
@ApiTags('Transaction Status')
@ApiBearerAuth('access-token')
@Controller('txn-status')
export class TxnStatusController {
  constructor(private readonly service: TxnStatusService) {}

  @Get('pending')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Every document whose latest status step is still DRAFT, HELD, CONFIRMED or IN_TRANSIT',
    description:
      'One row per pending document (module, doc type, refno, status, since, who), plus counts per module, doc type and status for the day-close summary. The latest step is by sequence number, never by timestamp.',
  })
  @ApiOkResponse({ description: 'items, counts and the total before paging.' })
  async pending(
    @Query() query: PendingTxnStatusQueryDto,
  ): Promise<{ success: true; message: string; data: PendingDocumentsResult }> {
    const data = await this.service.pending(query);
    return {
      success: true,
      message: data.total ? `${data.total} documents still pending` : 'Nothing is pending',
      data,
    };
  }
}
