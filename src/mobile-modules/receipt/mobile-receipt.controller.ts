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
  MobileReceiptStatusQueryDto,
} from './dto/mobile-receipt.dto';
import {
  MobileOpenBillsSuccessDto,
  MobileReceiptCreateSuccessDto,
  MobileReceiptOptionsSuccessDto,
  MobileReceiptStatusSuccessDto,
} from './dto/mobile-receipt-response.dto';
import { MobileReceiptService } from './mobile-receipt.service';
import { MobileReceiptStatusService } from './mobile-receipt-status.service';
import type {
  MobileOpenBillsPayload,
  MobileReceiptCreateResult,
  MobileReceiptOptions,
  MobileReceiptStatusPayload,
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
  constructor(
    private readonly mobileReceiptService: MobileReceiptService,
    private readonly mobileReceiptStatusService: MobileReceiptStatusService,
  ) {}

  @Get('options')
  @Version(API_VERSION)
  @OptionalAuth()
  @ApiSecurity({})
  @UseFilters(MobileExceptionFilter)
  @ApiOperation({
    summary:
      "The branch the phone's receipts land in, the tenders it may collect with, and the receipt rules",
    description:
      'The branch: branchId (the Switch company pick; 422 MOBILE_BRANCH_NOT_OF_COMPANY) or, ' +
      'without it, resolved as the upload resolves it (422 MOBILE_BRANCH_NOT_RESOLVED). ' +
      "Tenders: the company's live, active acc_tender_master rows for that branch or every " +
      'branch, in force today (tnd_effective_from / _to), with a ledger, of every type the desktop ' +
      'Receipt screen offers (never CREDIT, LOYALTY, TEMP_CR or an adjust tender, RRN / ADJUST), ' +
      'in display order; requiresBank = a cheque. settings: receiptBillSort and ppdEnabled (the ' +
      "company's, as open-items reads them), salesmanMandatory and pdcPostingMode (the branch's, " +
      'as the post reads them).',
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
    description: 'MOBILE_BRANCH_NOT_RESOLVED, MOBILE_BRANCH_NOT_OF_COMPANY',
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
      'within the party (the order a phone receipt fills them in), then by id. Each bill: kind ' +
      'BILL, paidAmount (billAmount - pendingAmount), pdcHeld (post-dated money not yet matured) ' +
      'and ppdSchedule (the prompt-payment steps still ahead: the first step whose tillDate is on ' +
      "or after the receipt date is the one). withCredits=true adds each customer's held credits " +
      'after its bills (kind ADVANCE, SALES_RETURN, OPENING_CR, JOURNAL_CR; pendingAmount = what is ' +
      'held), and total / the pages count them too. daysOverdue is measured on onDate, as ' +
      'open-items measures it. Customers only. Needs a token. 404 MOBILE_COMPANY_NOT_FOUND.',
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

  @Get('status')
  @Version(API_VERSION)
  @UseFilters(MobileExceptionFilter)
  @ApiOperation({
    summary: "What became of this phone's receipts: posted, cancelled, cheques cleared or bounced",
    description:
      'The receipts uploaded from this phone (deviceUid; POST /mobile/receipts/create) in ' +
      'companyId, changed at or after `since` (omitted: all), oldest change first, paged. Each: ' +
      'its client uuid, id, number and status, cancelledOn / cancelReason once cancelled, its ' +
      'cheques (pdc[]: the voucher carrying each, the cheque date, amount, status HELD / CLEARED ' +
      "/ BOUNCED / CANCELLED and the register's own houseStatus) and updatedOn. asOf is this " +
      "read's time less a five-minute overlap: send it back as `since`. Needs a token. 403 " +
      'MOBILE_DEVICE_*, 404 MOBILE_COMPANY_NOT_FOUND.',
  })
  @ApiOkResponse({ type: MobileReceiptStatusSuccessDto })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiUnauthorizedResponse({ type: HttpErrorResponseDto, description: 'No token, or a bad one' })
  @ApiForbiddenResponse({
    type: HttpErrorResponseDto,
    description: 'Phone not registered, blocked or inactive (MOBILE_DEVICE_*)',
  })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto, description: 'MOBILE_COMPANY_NOT_FOUND' })
  async status(
    @Query() query: MobileReceiptStatusQueryDto,
  ): Promise<MobileSuccess<MobileReceiptStatusPayload>> {
    const data = await this.mobileReceiptStatusService.status(query);
    return { success: true, message: 'Receipt status fetched successfully', data };
  }

  @Post('create')
  @Version(API_VERSION)
  @UseFilters(ReceiptExceptionFilter)
  @ApiOperation({
    summary:
      'Upload one receipt: saved and posted in one call, as the phone settled it or oldest bills first (safe to resend)',
    description:
      'avhClientUuid, deviceUid, avhCompanyId, avhPartyId (the customer id = its ledger id), ' +
      'avhBranchId (optional: the Switch company branch), avhVoucherDate (optional, today by ' +
      "default), avhUsrRefno (the phone's own number), avhDocRefno / avhDocDate (the shop's own " +
      'receipt no. and date; 409 VCH_DUP_DOC_REFNO when a live receipt of this customer this year ' +
      'has it), avhRemarks, tenders[] (from GET /mobile/receipts/options), and optionally the ' +
      "phone's settlement: allocations[] {billId, billAccYear, amount, discount, roundoff}, " +
      'creditsApplied[] {billId, billAccYear, amount} and onAccount (informational). Anything ' +
      'else (writeoff included) is a 400 VALIDATION_WHITELIST. The server fills the device (403 ' +
      'MOBILE_DEVICE_*), the branch (422 MOBILE_BRANCH_NOT_OF_COMPANY / _NOT_RESOLVED), the acc ' +
      "year (422 MOBILE_NO_FISCAL_YEAR), the login as the user, and the login's employee as the " +
      'collector (422 MOBILE_RECEIPT_NO_EMPLOYEE when accounts.receipt_salesman_mandatory is on ' +
      'and the login has none). Without allocations and creditsApplied the money fills the open ' +
      'bills oldest first (open-items order) and the rest is held on account, as before. With ' +
      "them the phone's settlement is posted, never refused because a bill moved since its Sync " +
      '(D1): each line is capped at what its bill can take now, a bill no longer open frees its ' +
      'line and drops its discount, credits are capped at what they hold, freed money goes to the ' +
      'open bills oldest first, then on account; every change is in adjusted[]. A discount above ' +
      'the prompt-payment suggestion for the receipt date is 422 MOBILE_RECEIPT_DISCOUNT_ABOVE_PPD, ' +
      'a round-off above 0.99 is 422 MOBILE_RECEIPT_ROUNDOFF_TOO_BIG. Saved AND posted in one ' +
      "transaction (notes 106) through the desktop's engine on the menu-99 Post right (403 " +
      "RCT_RIGHT_POST): a refusal saves nothing and is /receipts/post's (VCH_*, ACC_*, TENDER_*). " +
      'The same avhClientUuid again answers the receipt already saved, read back from the ' +
      'database (duplicate: true) and writes nothing; on another customer it is a 409 ' +
      'MOBILE_CLIENT_UUID_REUSED.',
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
