import { CacheTTL } from '@nestjs/cache-manager';
import { Body, Catch, Controller, Get, Put, Query, UseFilters, Version } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { API_VERSION } from '../../../common/constants/api-version';
import { SalesExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import type { ModuleErrorDetail, ModuleErrorResponse } from 'src/common/utils/module-service.utils';
import { OpenTempCreditsQueryDto, TempCreditFollowUpDto } from './dto/temp-credit.dto';
import { TempCreditService } from './temp-credit.service';

@Catch()
export class TempCreditExceptionFilter extends SalesExceptionFilter<
  ModuleErrorDetail,
  ModuleErrorResponse<ModuleErrorDetail>
> {
  constructor() {
    super(/\b(atc[A-Za-z0-9]+|companyId|branchId|status|search|overdueOnly|promiseDate|remarks)\b/);
  }
}

/** HANDOVER §7 — `/api/v1/temp-credits`. */
@ApiTags('Temporary Credits')
@ApiBearerAuth('access-token')
@CacheTTL(1)
@Controller('temp-credits')
@UseFilters(TempCreditExceptionFilter)
export class TempCreditController {
  constructor(private readonly service: TempCreditService) {}

  @Get('open')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Grid rows of accounts.acc_temp_credit with daysOverdue' })
  async open(@Query() q: OpenTempCreditsQueryDto) {
    return {
      success: true,
      message: 'Temporary credits fetched',
      data: await this.service.open(q),
    };
  }

  @Put('follow-up')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Record a follow-up (promise date, remarks) on a temporary credit' })
  async followUp(@Body() dto: TempCreditFollowUpDto) {
    return { success: true, message: 'Follow-up recorded', data: await this.service.followUp(dto) };
  }
}
