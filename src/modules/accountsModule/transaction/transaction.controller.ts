import { CacheTTL } from '@nestjs/cache-manager';
import { Controller, Get, Query, UseFilters, Version } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { API_VERSION } from '../../../common/constants/api-version';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import {
  AdjustableCreditListSuccessDto,
  TransactionErrorResponseDto,
} from './dto/adjustable-credit-response.dto';
import { GetPartyAdjustableCreditsDto } from './dto/get-party-adjustable-credits.dto';
import { TransactionExceptionFilter } from './transaction-exception.filter';
import { TransactionService } from './transaction.service';
import { AdjustableCredit, TransactionSuccessResponse } from './types/transaction-api.types';

@ApiTags('Transaction')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('transactions')
@UseFilters(TransactionExceptionFilter)
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) { }
  @Get('party-balance')
  @Version(API_VERSION)
  @ApiOperation({
    summary: "Get a party's unspent credits, available to adjust against a bill",
    description:
      'Every open ADVANCE and SALES_RETURN the party holds on the side named by `type` — CR ' +
      '(the company owes the party) when it is omitted, DR (the party owes the company) when ' +
      'asked for — oldest first (FIFO), ' +
      'tie-broken on docRefno so two credits dated the same day never swap places between fetches. ' +
      'Each row carries billType and the adjType / settlementMode it settles as, plus billAccYear — ' +
      'post that alongside billId, since acc_bill_balance is keyed on the pair. There is no ' +
      'accounting-year parameter: credits are never carried forward, so the read spans every year. ' +
      'A party with no credit — and an unknown party — comes back as an empty array.',
  })
  @ApiOkResponse({ type: AdjustableCreditListSuccessDto })
  @ApiBadRequestResponse({ type: TransactionErrorResponseDto })
  async get(
    @Query() getPartyAdjustableCreditsDto: GetPartyAdjustableCreditsDto,
  ): Promise<TransactionSuccessResponse<AdjustableCredit[]>> {
    const data = await this.transactionService.getPartyAdjustableCredits(
      getPartyAdjustableCreditsDto,
    );
    return {
      success: true,
      message: 'Party adjustable credits fetched successfully',
      data,
    };
  }
}
