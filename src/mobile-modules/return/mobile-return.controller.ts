import { Body, Controller, Get, Post, Query, Req, UseFilters, Version } from '@nestjs/common';
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
import { DataChangeService } from '../../common/data-changes/data-change.service';
import { wordingFor, wordingLangOf } from '../../common/error-wording/error-wording';
import { MobileExceptionFilter } from '../common/mobile-exception.filter';
import {
  CreateMobileReturnDto,
  DeleteMobileReturnDto,
  MobileReturnBillLinesQueryDto,
  MobileReturnOptionsQueryDto,
  MobileReturnStatusQueryDto,
} from './dto/mobile-return.dto';
import {
  MobileReturnBillLinesSuccessDto,
  MobileReturnCreateSuccessDto,
  MobileReturnDeleteSuccessDto,
  MobileReturnOptionsSuccessDto,
  MobileReturnStatusSuccessDto,
} from './dto/mobile-return-response.dto';
import { MobileReturnExceptionFilter } from './mobile-return-exception.filter';
import { MobileReturnService } from './mobile-return.service';
import { MobileReturnStatusService } from './mobile-return-status.service';
import type {
  MobileReturnBillLinesPayload,
  MobileReturnCreateResult,
  MobileReturnDeleteResult,
  MobileReturnNote,
  MobileReturnOptions,
  MobileReturnStatusPayload,
} from './types/mobile-return-api.types';

type MobileSuccess<T> = { success: true; message: string; data: T };

type SessionRequest = {
  user?: { sid?: string | null };
  query?: unknown;
  headers?: Record<string, unknown>;
};

const CREATE_MESSAGES: Record<string, string> = {
  POSTED: 'Return created and posted successfully',
  HELD: 'Return saved; it waits for the office',
  SENT_BACK: 'Return saved; it was sent back to fix',
};

/**
 * Sale returns from the React Native salesman app (VKSMAN canvas page 6b,
 * plan-mobile-sales-return-2026-11-20). The return is the desktop's (menu 13,
 * /sale-returns): saved through its DRAFT upsert (the money worked out by the
 * server) and posted at once behind a savepoint, so the number, stock, the
 * SRt voucher, the credit note, the settlement, the approval gate and the
 * SALES_* codes are the desktop's. A refused post keeps the DRAFT: HELD (only
 * the office can clear it) or SENT_BACK (fix it on the phone and send the same
 * srClientUuid again).
 *
 * /create, /delete, /bill-lines and /status need a token. /options is
 * @OptionalAuth like the other mobile reads (rights only with a token). No
 * @CacheTTL: the answers are company, branch and login specific.
 */
@ApiTags('Mobile · Returns')
@ApiBearerAuth('access-token')
@Controller('mobile/returns')
export class MobileReturnController {
  constructor(
    private readonly mobileReturnService: MobileReturnService,
    private readonly mobileReturnStatusService: MobileReturnStatusService,
    private readonly dataChangeService: DataChangeService,
  ) {}

  @Get('options')
  @Version(API_VERSION)
  @OptionalAuth()
  @ApiSecurity({})
  @UseFilters(MobileExceptionFilter)
  @ApiOperation({
    summary:
      "What a phone return needs: the branch, reasons, godowns, settings and the login's rights",
    description:
      'The branch: branchId (the Switch company pick; 422 MOBILE_BRANCH_NOT_OF_COMPANY) or, without ' +
      'it, the device rule (422 MOBILE_BRANCH_NOT_RESOLVED). reasons: the SALE_RETURN reasons the ' +
      "company sees (shared + its own, its own winning by code), as the desktop's dropdown 78; " +
      'isClaim = code ends in _SHOP (hide them, D8). godowns: the live, active godowns of the ' +
      'branch, the default first. settings: returnWindowDays, freeReturnAllowed, settleDefault, ' +
      'expiredLotDays, billDays (returnWindowDays when above 0, else 90). rights: menu 13 create / ' +
      'post of the login, null without a token.',
  })
  @ApiOkResponse({ type: MobileReturnOptionsSuccessDto })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiForbiddenResponse({ type: HttpErrorResponseDto, description: 'MOBILE_DEVICE_*' })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto, description: 'MOBILE_COMPANY_NOT_FOUND' })
  @ApiUnprocessableEntityResponse({
    type: HttpErrorResponseDto,
    description: 'MOBILE_BRANCH_NOT_RESOLVED, MOBILE_BRANCH_NOT_OF_COMPANY',
  })
  async options(
    @Query() query: MobileReturnOptionsQueryDto,
  ): Promise<MobileSuccess<MobileReturnOptions>> {
    const data = await this.mobileReturnService.options(query);
    return { success: true, message: 'Return options fetched successfully', data };
  }

  @Get('bill-lines')
  @Version(API_VERSION)
  @UseFilters(MobileExceptionFilter)
  @ApiOperation({
    summary:
      'Posted bills of the branch over a date window, every customer, paged by bill, with what is left to return',
    description:
      'Bills: POSTED, live, of the branch (branchId or the device rule), dated since or later ' +
      '(default today less billDays), of every customer of the company, newest first. Each line ' +
      'carries the desktop /sale-returns/bill-lines figures (the same reader): billQtyBase, ' +
      'returnedQtyBase (POSTED returns), qtyLeftBase, onOtherDraftsBase (DRAFT returns, INFO), plus ' +
      'ratePreTaxBase = taxable per base unit after every discount (4 decimals). Needs a token.',
  })
  @ApiOkResponse({ type: MobileReturnBillLinesSuccessDto })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiUnauthorizedResponse({ type: HttpErrorResponseDto, description: 'No token, or a bad one' })
  @ApiForbiddenResponse({ type: HttpErrorResponseDto, description: 'MOBILE_DEVICE_*' })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto, description: 'MOBILE_COMPANY_NOT_FOUND' })
  @ApiUnprocessableEntityResponse({ type: HttpErrorResponseDto, description: 'MOBILE_BRANCH_*' })
  async billLines(
    @Query() query: MobileReturnBillLinesQueryDto,
  ): Promise<MobileSuccess<MobileReturnBillLinesPayload>> {
    const data = await this.mobileReturnService.billLines(query);
    return { success: true, message: 'Bill lines fetched successfully', data };
  }

  @Get('status')
  @Version(API_VERSION)
  @UseFilters(MobileExceptionFilter)
  @ApiOperation({
    summary: "What became of this phone's returns: posted, approved, cancelled, deleted",
    description:
      'The returns uploaded from this phone (deviceUid; sr_device_id = its dev_id, with a client ' +
      'uuid) in companyId, changed at or after `since` (omitted: all), oldest change first, paged. ' +
      'status DRAFT · POSTED · CANCELLED · DELETED (a draft deleted in the office or by the phone); ' +
      'approval: the latest request not withdrawn (PENDING · APPROVED · REJECTED, an expired one ' +
      'reads REJECTED). asOf = this read less five minutes: send it back as since. Needs a token.',
  })
  @ApiOkResponse({ type: MobileReturnStatusSuccessDto })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiUnauthorizedResponse({ type: HttpErrorResponseDto, description: 'No token, or a bad one' })
  @ApiForbiddenResponse({ type: HttpErrorResponseDto, description: 'MOBILE_DEVICE_*' })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto, description: 'MOBILE_COMPANY_NOT_FOUND' })
  async status(
    @Query() query: MobileReturnStatusQueryDto,
  ): Promise<MobileSuccess<MobileReturnStatusPayload>> {
    const data = await this.mobileReturnStatusService.status(query);
    return { success: true, message: 'Return status fetched successfully', data };
  }

  @Post('create')
  @Version(API_VERSION)
  @UseFilters(MobileReturnExceptionFilter)
  @ApiOperation({
    summary:
      'Upload one sale return: saved, then posted at once; POSTED, HELD or SENT_BACK (safe to resend)',
    description:
      'The server fills the device (403 MOBILE_DEVICE_*), the branch (422 MOBILE_BRANCH_*), the acc ' +
      "year (422 MOBILE_NO_FISCAL_YEAR), the login as the user, the counter (the phone's dev_id), " +
      "kind RETURN, the salesmen (the bill's; no bill: the login's employee of this company), " +
      "each line's godown (godownId for all, else the bill line's, else the branch default; 422 " +
      'MOBILE_GODOWN_INVALID) and all the money (D45; no money key is taken). 422 ' +
      'MOBILE_RETURN_CUSTOMER_NOT_FOUND, MOBILE_RETURN_REASON_INVALID, SALES_RETURN_BILL_NOT_POSTED, ' +
      'MOBILE_RETURN_BILL_OTHER_CUSTOMER. The menu-13 CREATE / EDIT right is not needed. Then the ' +
      'post (the menu-13 Post right) behind a savepoint: stale Adjust rows are re-planned (replanned[]). ' +
      'A refused post keeps the DRAFT: HELD (held: TILL_APPROVAL_REQUIRED, whose request is filed ' +
      'for the office inbox; SALES_RETURN_WINDOW, GST_CREDIT_NOTE_CUTOFF, SALES_RETURN_LOT_EXPIRED, ' +
      'SALES_RETURN_NO_PRICE, SALES_RETURN_SCHEME_SHORT; SALES_RIGHT_POST; TILL_SESSION_*) or ' +
      'SENT_BACK (refusal: every other code). The same srClientUuid again: POSTED / CANCELLED is ' +
      'answered as it stands (duplicate: true); a DRAFT is saved again with this body and posted ' +
      'again (a DRAFT waiting on an approval is not re-saved, only posted again); another customer ' +
      'is 409 MOBILE_CLIENT_UUID_REUSED; a return the office deleted is 409 MOBILE_RETURN_DELETED.',
  })
  @ApiCreatedResponse({ type: MobileReturnCreateSuccessDto })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiUnauthorizedResponse({ type: HttpErrorResponseDto, description: 'No token, or a bad one' })
  @ApiForbiddenResponse({ type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: HttpErrorResponseDto })
  async create(
    @Body() dto: CreateMobileReturnDto,
    @Req() request: SessionRequest,
  ): Promise<MobileSuccess<MobileReturnCreateResult>> {
    const created = await this.mobileReturnService.create(dto);
    const data = withNoteWording(created, wordingLangOf(request));
    if (!data.duplicate) {
      // The write interceptor announces `returns` (the path after /mobile);
      // open desktop return lists listen for `sale-returns`.
      this.publish(request);
    }
    return {
      success: true,
      message: data.duplicate ? 'Return already saved' : CREATE_MESSAGES[data.status],
      data,
    };
  }

  @Post('delete')
  @Version(API_VERSION)
  @UseFilters(MobileReturnExceptionFilter)
  @ApiOperation({
    summary: 'Delete a DRAFT return this phone sent (HELD or SENT_BACK)',
    description:
      "Through the desktop delete (menu-13 DELETE right); the return's own PENDING approval request " +
      'is withdrawn first. POSTED: 409 SALES_DOC_POSTED (the office cancels it); CANCELLED: 409 ' +
      'SALES_DOC_CANCELLED. A uuid VK Nex never saw: deleted false. Deleted before: deleted true, ' +
      'duplicate true.',
  })
  @ApiCreatedResponse({ type: MobileReturnDeleteSuccessDto })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiUnauthorizedResponse({ type: HttpErrorResponseDto, description: 'No token, or a bad one' })
  @ApiForbiddenResponse({
    type: HttpErrorResponseDto,
    description: 'MOBILE_DEVICE_*, SALES_RIGHT_DELETE',
  })
  @ApiConflictResponse({
    type: HttpErrorResponseDto,
    description: 'SALES_DOC_POSTED, SALES_DOC_CANCELLED',
  })
  async remove(
    @Body() dto: DeleteMobileReturnDto,
    @Req() request: SessionRequest,
  ): Promise<MobileSuccess<MobileReturnDeleteResult>> {
    const data = await this.mobileReturnService.delete(dto);
    if (data.deleted && !data.duplicate) {
      this.publish(request);
    }
    return {
      success: true,
      message: data.deleted ? 'Return deleted' : 'No such return',
      data,
    };
  }

  private publish(request: SessionRequest): void {
    this.dataChangeService.publish({
      resource: 'sale-returns',
      method: 'POST',
      at: Date.now(),
      originSessionId: request.user?.sid ?? null,
    });
  }
}

/** held / refusal with the catalogue's plain words, as the filters word errors[]. */
function withNoteWording(data: MobileReturnCreateResult, lang: string): MobileReturnCreateResult {
  const word = (note: MobileReturnNote | null): MobileReturnNote | null => {
    if (!note) {
      return null;
    }
    const user = wordingFor({ ...note }, lang);
    return user ? { ...note, user } : note;
  };
  return { ...data, held: word(data.held), refusal: word(data.refusal) };
}
