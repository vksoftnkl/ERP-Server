import { Body, Controller, Get, Post, Query, UseFilters, Version } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { API_VERSION } from '../../common/constants/api-version';
import { OptionalAuth } from '../../common/decorators/optional-auth.decorator';
import { HttpErrorResponseDto } from '../../common/dto/http-error-response.dto';
import { ReceiptExceptionFilter } from '../../modules/accountsModule/receipt/receipt-exception.filter';
import { ReceiptErrorResponseDto } from '../../modules/accountsModule/receipt/dto/receipt-response.dto';
import { MobileExceptionFilter } from '../common/mobile-exception.filter';
import {
  CreateMobileReceiptDto,
  MobileOpenBillsQueryDto,
  MobileReceiptOptionsQueryDto,
} from './dto/mobile-receipt.dto';
import {
  MobileOpenBillsSuccessDto,
  MobileReceiptCreateSuccessDto,
  MobileReceiptOptionsSuccessDto,
} from './dto/mobile-receipt-response.dto';
import { MobileReceiptService } from './mobile-receipt.service';
import type {
  MobileOpenBillsPayload,
  MobileReceiptCreateResult,
  MobileReceiptOptions,
} from './types/mobile-receipt-api.types';

type MobileSuccess<T> = { success: true; message: string; data: T };

/**
 * Money collected by the salesman, from the React Native app. A receipt is
 * saved AND posted in one call through the desktop's one-call save-and-post
 * (notes 106), so the number, legs, tender rows, cheque register, bill
 * settlement, ADVANCE remainder, status trail, the menu-99 Post right and the
 * RCT_ / VCH_ / ACC_ codes are the desktop's; the ReceiptExceptionFilter
 * shapes the errors.
 *
 * The upload needs a token (posting judges the login's menu rights): 401
 * without one, and so does /open-bills (customer balances; the ledger
 * statement needs a login too). /options is @OptionalAuth like the other
 * mobile reads. No @CacheTTL: the answers are company and branch specific.
 */
@ApiTags('Mobile · Receipts')
@ApiBearerAuth('access-token')
@Controller('mobile/receipts')
export class MobileReceiptController {
  constructor(private readonly mobileReceiptService: MobileReceiptService) {}

  @Get('options')
  @Version(API_VERSION)
  @OptionalAuth()
  @ApiSecurity({})
  @UseFilters(MobileExceptionFilter)
  @ApiOperation({
    summary: "The branch the phone's receipts land in, and the tenders it may collect with",
    description:
      'The branch is resolved as the upload resolves it (422 MOBILE_BRANCH_NOT_RESOLVED). ' +
      "Tenders: the company's live, active acc_tender_master rows for that branch or every " +
      'branch, in force today (tnd_effective_from / _to), with a ledger, of type CASH, CARD, UPI, ' +
      'WALLET, CHEQUE or BANK (never CREDIT, TEMP_CR, LOYALTY, RRN or a gift voucher), in display order.',
  })
  @ApiOkResponse({ type: MobileReceiptOptionsSuccessDto })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiForbiddenResponse({
    type: HttpErrorResponseDto,
    description: 'Phone not registered, blocked or inactive (MOBILE_DEVICE_*)',
  })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto, description: 'MOBILE_COMPANY_NOT_FOUND' })
  @ApiUnprocessableEntityResponse({
    type: HttpErrorResponseDto,
    description: 'MOBILE_BRANCH_NOT_RESOLVED',
  })
  @ApiUnauthorizedResponse({
    type: HttpErrorResponseDto,
    description: 'Only when a token is sent and it is malformed, expired or revoked',
  })
  async options(
    @Query() query: MobileReceiptOptionsQueryDto,
  ): Promise<MobileSuccess<MobileReceiptOptions>> {
    const data = await this.mobileReceiptService.options(query);
    return { success: true, message: 'Receipt options fetched successfully', data };
  }

  @Get('open-bills')
  @Version(API_VERSION)
  @UseFilters(MobileExceptionFilter)
  @ApiOperation({
    summary: "Every customer's open bills in the company, paged (what a receipt would settle)",
    description:
      'The rows and the order of /receipts/open-items, for every party of the company at once: ' +
      'live, active DR bills of a receivable type (SALES, OPENING, INTEREST, JOURNAL, ' +
      'PURCHASE_RETURN) with something pending, by party, then in accounts.receipt_bill_sort order ' +
      'within the party (the order a phone receipt fills them in), then by id. daysOverdue is ' +
      'measured on onDate, as open-items measures it. Needs a token. 404 MOBILE_COMPANY_NOT_FOUND.',
  })
  @ApiOkResponse({ type: MobileOpenBillsSuccessDto })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiUnauthorizedResponse({ type: HttpErrorResponseDto, description: 'No token, or a bad one' })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto, description: 'MOBILE_COMPANY_NOT_FOUND' })
  async openBills(
    @Query() query: MobileOpenBillsQueryDto,
  ): Promise<MobileSuccess<MobileOpenBillsPayload>> {
    const data = await this.mobileReceiptService.openBills(query);
    return { success: true, message: 'Open bills fetched successfully', data };
  }

  @Post('create')
  @Version(API_VERSION)
  @UseFilters(ReceiptExceptionFilter)
  @ApiOperation({
    summary:
      'Upload one receipt: saved and posted in one call, oldest bills first (safe to resend)',
    description:
      'avhClientUuid, deviceUid, avhCompanyId, avhPartyId (the customer id = its ledger id), ' +
      "avhVoucherDate (optional, today by default), avhUsrRefno (the phone's own number), " +
      'avhRemarks and tenders[] (tdTenderId, tdTenderTypeId, tdAmount, tdRefNo, tdBankName, ' +
      'tdInstrumentDate, cheque; from GET /mobile/receipts/options). Anything else is a 400 ' +
      'VALIDATION_WHITELIST. The server fills the device (403 MOBILE_DEVICE_*; avhDeviceType ' +
      'MOBILE), the branch (422 MOBILE_BRANCH_NOT_RESOLVED), the acc year (422 ' +
      'MOBILE_NO_FISCAL_YEAR), the login as the user, and the settlement: the money (less any ' +
      "surcharge the tender master adds) fills the customer's open bills in /receipts/open-items " +
      'order (accounts.receipt_bill_sort, due date first by default), each up to what it owes; ' +
      'the rest is held on account as an ADVANCE. Saved AND posted in one transaction (notes 106) ' +
      "on the menu-99 Post right (403 RCT_RIGHT_POST): a refusal saves nothing and is /receipts/post's " +
      '(VCH_*, ACC_*, TENDER_*). The same avhClientUuid again answers the receipt already saved ' +
      '(duplicate: true) and writes nothing; on another customer it is a 409 MOBILE_CLIENT_UUID_REUSED.',
  })
  @ApiCreatedResponse({ type: MobileReceiptCreateSuccessDto })
  @ApiBadRequestResponse({ type: ReceiptErrorResponseDto })
  @ApiUnauthorizedResponse({ type: HttpErrorResponseDto, description: 'No token, or a bad one' })
  @ApiForbiddenResponse({ type: ReceiptErrorResponseDto })
  @ApiNotFoundResponse({ type: ReceiptErrorResponseDto })
  @ApiConflictResponse({ type: ReceiptErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ReceiptErrorResponseDto })
  async create(
    @Body() dto: CreateMobileReceiptDto,
  ): Promise<MobileSuccess<MobileReceiptCreateResult>> {
    const data = await this.mobileReceiptService.create(dto);
    // The write interceptor announces `receipts` (the path after /mobile), the
    // desktop receipt list's own resource, so nothing is published by hand.
    return {
      success: true,
      message: data.duplicate ? 'Receipt already saved' : 'Receipt created and posted successfully',
      data,
    };
  }
}
