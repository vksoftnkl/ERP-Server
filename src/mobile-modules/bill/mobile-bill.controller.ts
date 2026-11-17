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
import { BillExceptionFilter } from '../../modules/sales/bill/bill-exception.filter';
import { BillErrorResponseDto } from '../../modules/sales/bill/dto/bill-response.dto';
import { MobileExceptionFilter } from '../common/mobile-exception.filter';
import { CreateMobileBillDto, MobileBillOptionsQueryDto } from './dto/mobile-bill.dto';
import {
  MobileBillCreateSuccessDto,
  MobileBillOptionsSuccessDto,
} from './dto/mobile-bill-response.dto';
import { MobileBillService } from './mobile-bill.service';
import type { MobileBillCreateResult, MobileBillOptions } from './types/mobile-bill-api.types';

type MobileSuccess<T> = { success: true; message: string; data: T };

/**
 * Sales bills from the React Native salesman app. A bill is saved AND posted
 * in one call through the desktop's one-call save-and-post (notes 106), so the
 * number, stock, voucher, receivable, status trail, revision, the menu-12
 * Post right and the SALES_* / VT_* codes are the desktop's; the
 * BillExceptionFilter shapes the errors.
 *
 * The upload needs a token (posting judges the login's menu rights): 401
 * without one. /options is @OptionalAuth like the other mobile reads. No
 * @CacheTTL: the answers are company and branch specific.
 */
@ApiTags('Mobile · Bills')
@ApiBearerAuth('access-token')
@Controller('mobile/bills')
export class MobileBillController {
  constructor(private readonly mobileBillService: MobileBillService) {}

  @Get('options')
  @Version(API_VERSION)
  @OptionalAuth()
  @ApiSecurity({})
  @UseFilters(MobileExceptionFilter)
  @ApiOperation({
    summary: "The branch the phone's bills land in, and the godowns a bill line may draw on",
    description:
      "The branch is resolved as the upload resolves it (the phone's own branch when it belongs " +
      "to companyId, else the company's default branch, else its only branch; 422 " +
      'MOBILE_BRANCH_NOT_RESOLVED). Godowns: inventory.godown_locations of that branch, live and ' +
      'active, the branch default (br_default_godown_id) first. Send one as sbiGodownId.',
  })
  @ApiOkResponse({ type: MobileBillOptionsSuccessDto })
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
    @Query() query: MobileBillOptionsQueryDto,
  ): Promise<MobileSuccess<MobileBillOptions>> {
    const data = await this.mobileBillService.options(query);
    return { success: true, message: 'Bill options fetched successfully', data };
  }

  @Post('create')
  @Version(API_VERSION)
  @UseFilters(BillExceptionFilter)
  @ApiOperation({
    summary: 'Upload one sales bill: saved and posted in one call (safe to resend)',
    description:
      'The desktop /bills/create payload (sb* / sbi*) without sbId, sbBranchId, sbTenantId, ' +
      'sbAccYear, sbSessionId, sbCounterId, sbDeviceType, sbDeviceId, sbBillSlno / sbBillRefno, ' +
      'sbBillMode, sbStatus, post, the posted / server-owned columns, the source-document keys, ' +
      'tenders, charges, adjustments, sbUserId and the audit names (400 VALIDATION_WHITELIST), plus ' +
      'sbClientUuid and deviceUid. Every line names sbiGodownId (GET /mobile/bills/options); a ' +
      'godown that is not a live, active one of the branch is 422 MOBILE_GODOWN_INVALID. The ' +
      'server fills: the device (the registered phone, 403 MOBILE_DEVICE_*; sbDeviceType MOBILE), ' +
      'the branch (422 MOBILE_BRANCH_NOT_RESOLVED), the acc year (the financial year holding ' +
      'sbBillDate, today when omitted; 422 MOBILE_NO_FISCAL_YEAR), sbBillType CREDIT, the login as ' +
      "sbUserId, and VK Nex's number (the branch's Sales Bill series; the phone's own number " +
      'rides in sbUsrRefno). Saved AND posted in one transaction (notes 106): a refusal saves ' +
      'nothing, burns no number and is exactly what /bills/post answers (SALES_RIGHT_POST without ' +
      'the menu-12 Post right, the stock / credit-limit / rate codes, the WARN list; overrides[] ' +
      'as on the desktop). The same sbClientUuid again answers the bill already saved ' +
      '(duplicate: true) and writes nothing; on another customer it is a 409 ' +
      'MOBILE_CLIENT_UUID_REUSED.',
  })
  @ApiCreatedResponse({ type: MobileBillCreateSuccessDto })
  @ApiBadRequestResponse({ type: BillErrorResponseDto })
  @ApiUnauthorizedResponse({ type: HttpErrorResponseDto, description: 'No token, or a bad one' })
  @ApiForbiddenResponse({ type: BillErrorResponseDto })
  @ApiNotFoundResponse({ type: BillErrorResponseDto })
  @ApiConflictResponse({ type: BillErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: BillErrorResponseDto })
  async create(@Body() dto: CreateMobileBillDto): Promise<MobileSuccess<MobileBillCreateResult>> {
    const data = await this.mobileBillService.create(dto);
    // The write interceptor announces `bills` (the path after /mobile), the
    // desktop bill lists' own resource, so nothing is published by hand.
    return {
      success: true,
      message: data.duplicate ? 'Bill already saved' : 'Bill created and posted successfully',
      data,
    };
  }
}
