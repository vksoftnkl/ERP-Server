import { Body, Controller, Post, Req, UseFilters, Version } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { API_VERSION } from '../../common/constants/api-version';
import { wordingFor, wordingLangOf } from '../../common/error-wording/error-wording';
import { OptionalAuth } from '../../common/decorators/optional-auth.decorator';
import { HttpErrorResponseDto } from '../../common/dto/http-error-response.dto';
import { DataChangeService } from '../../common/data-changes/data-change.service';
import { SaleOrderExceptionFilter } from '../../modules/sales/sale-order/sale-order-exception.filter';
import { SaleOrderErrorResponseDto } from '../../modules/sales/sale-order/dto/sale-order-response.dto';
import { CreateMobileOrderDto } from './dto/mobile-order.dto';
import { MobileOrderService } from './mobile-order.service';
import type { MobileOrderCreateResult } from './types/mobile-order-api.types';

type SessionRequest = {
  user?: { sid?: string | null };
  query?: unknown;
  headers?: Record<string, unknown>;
};

class MobileOrderUserWordingDto {
  @ApiProperty({ example: 'Day closed' }) title!: string;
  @ApiProperty({ example: 'Today is closed for billing.' }) line!: string;
  @ApiProperty({ example: 'Call manager.' }) todo!: string;
}

class MobileOrderConfirmRefusalDto {
  @ApiProperty({ example: 'SALES_DAY_CLOSED' }) code!: string;
  @ApiProperty({ type: String, nullable: true, example: 'soOrderDate' }) field!: string | null;
  @ApiProperty({ example: 'The books for 2026-11-19 are closed at this branch' })
  message!: string;
  @ApiPropertyOptional({
    type: MobileOrderUserWordingDto,
    description: "The catalogue's plain words for the code (fixed.error_message); absent when none",
  })
  user?: MobileOrderUserWordingDto;
}

class MobileOrderReserveShortDto {
  @ApiProperty({ example: 'SALES_RESERVE_SHORT' }) code!: string;
  @ApiProperty({ example: 1 }) line!: number;
  @ApiProperty({ example: 6, description: 'Quantity the stock could not hold for the line' })
  short!: number;
  @ApiProperty() message!: string;
  @ApiPropertyOptional({ type: MobileOrderUserWordingDto }) user?: MobileOrderUserWordingDto;
}

class MobileOrderWhatsappDto {
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) wmlId!: string | null;
  @ApiProperty({ type: String, nullable: true, example: '2026-2027' }) accYear!: string | null;
  @ApiProperty({ enum: ['SENDING', 'SKIPPED', 'FAILED', 'NOT_CONNECTED'] }) status!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) errorCode?: string | null;
  @ApiPropertyOptional() fallbackClickToChat?: boolean;
}

class MobileOrderCreateResultDto {
  @ApiProperty({ format: 'uuid' }) soId!: string;
  @ApiProperty({ example: 'sor00042' }) soOrderRefno!: string;
  @ApiProperty({
    example: 'CONFIRMED',
    description:
      'Now: CONFIRMED when this upload confirmed it, DRAFT when the confirm was refused ' +
      '(confirmRefused says why); a resend reads the stored one',
  })
  soStatus!: string;
  @ApiProperty({ example: '2026-2027' }) soAccYear!: string;
  @ApiProperty({ description: 'true = saved before under this soClientUuid; nothing written now' })
  duplicate!: boolean;
  @ApiProperty({ description: 'A resend of an order the office has since deleted' })
  soIsDeleted!: boolean;
  @ApiProperty({
    type: MobileOrderConfirmRefusalDto,
    nullable: true,
    description:
      'Why the new order was kept DRAFT (the first error the confirm refused with); null when ' +
      'confirmed, and on a resend',
  })
  confirmRefused!: MobileOrderConfirmRefusalDto | null;
  @ApiProperty({
    type: [MobileOrderReserveShortDto],
    description:
      "The confirm's reservation shortfalls, as /sale-orders/post answers them: a warning, " +
      'never a refusal. [] on a resend and when kept DRAFT',
  })
  warnings!: MobileOrderReserveShortDto[];
  @ApiPropertyOptional({
    type: MobileOrderWhatsappDto,
    description:
      'WhatsApp on Post, as /sale-orders/post answers it: only when this upload confirmed the ' +
      "order and the company's whatsapp.on_post_types lists Sales Order (4). Never on a resend " +
      'or a DRAFT',
  })
  whatsapp?: MobileOrderWhatsappDto;
}

class MobileOrderCreateSuccessDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty() message!: string;
  @ApiProperty({ type: MobileOrderCreateResultDto }) data!: MobileOrderCreateResultDto;
}

/**
 * Order upload for the React Native salesman app. The order is saved through
 * the desktop SaleOrderService, so number, lines, CHECK mirrors, status trail,
 * revision and the SALE_ORDER_* / SALES_* codes are the desktop's; the
 * SaleOrderExceptionFilter shapes the errors.
 *
 * @OptionalAuth, like /mobile/customers: no token needed (so_user_id then
 * comes from the body, and the audit names the default actor). A sent token
 * is still checked, and its user is the order's.
 */
@ApiTags('Mobile · Orders')
@OptionalAuth()
@ApiBearerAuth('access-token')
@ApiSecurity({})
@ApiUnauthorizedResponse({
  type: HttpErrorResponseDto,
  description: 'Only when a token is sent and it is malformed, expired or revoked',
})
@Controller('mobile/orders')
@UseFilters(SaleOrderExceptionFilter)
export class MobileOrderController {
  constructor(
    private readonly mobileOrderService: MobileOrderService,
    private readonly dataChangeService: DataChangeService,
  ) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Upload one order with its lines (safe to resend)',
    description:
      'The desktop /sale-orders/create payload (so* / soi*) without soId, soAccYear, ' +
      'soDeviceId, soOrderSlno / soOrderRefno, soSessionId, soStatus, post, charges and ' +
      'tenders (400 VALIDATION_WHITELIST), plus soClientUuid and deviceUid. soBranchId is ' +
      'optional: the branch the salesman picked, which must be an active branch of ' +
      'soCompanyId (422 MOBILE_BRANCH_NOT_OF_COMPANY). The server fills: the device (the ' +
      'registered phone, 403 MOBILE_DEVICE_*), the branch when soBranchId is absent (the ' +
      "phone's when it belongs to soCompanyId, else the company default; 422 " +
      "MOBILE_BRANCH_NOT_RESOLVED), the acc year (the company's financial year holding " +
      'soOrderDate, today when omitted; 422 MOBILE_NO_FISCAL_YEAR) and the number (voucher ' +
      'type 4). A line with no soiGodownId is saved in its item godown, as a desktop sale ' +
      "line defaults it: the item's price-row godown for its unit, else the branch's live " +
      'default godown (user, 2026-11-20). The order is then confirmed in the same ' +
      'transaction, as /sale-orders/post would (stock reserved, CONFIRMED), without the menu-11 ' +
      'Post right check (user, 2026-11-19); shortfalls come back in warnings[], and WhatsApp ' +
      "on Post follows the commit as on the desktop (the company's setting decides; whatsapp " +
      'block). When the confirm is refused (a closed ' +
      'day, a closed or locked year, an invalid salesman …) the order is kept DRAFT and ' +
      'confirmRefused says why; the upload still succeeds. The same soClientUuid again answers ' +
      'the order already saved (duplicate: true) and writes nothing; on another customer it ' +
      'is a 409 MOBILE_CLIENT_UUID_REUSED.',
  })
  @ApiCreatedResponse({ type: MobileOrderCreateSuccessDto })
  @ApiBadRequestResponse({ type: SaleOrderErrorResponseDto })
  @ApiForbiddenResponse({ type: SaleOrderErrorResponseDto })
  @ApiNotFoundResponse({ type: SaleOrderErrorResponseDto })
  @ApiConflictResponse({ type: SaleOrderErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: SaleOrderErrorResponseDto })
  async create(
    @Body() dto: CreateMobileOrderDto,
    @Req() request: SessionRequest,
  ): Promise<{ success: true; message: string; data: MobileOrderCreateResult }> {
    const created = await this.mobileOrderService.create(dto);
    const data = withRefusalWording(created, wordingLangOf(request));
    if (!data.duplicate) {
      // The write interceptor announces `orders` (the path after /mobile);
      // open desktop order lists listen for `sale-orders`.
      this.dataChangeService.publish({
        resource: 'sale-orders',
        method: 'POST',
        at: Date.now(),
        originSessionId: request.user?.sid ?? null,
      });
    }
    return {
      success: true,
      message: data.duplicate ? 'Order already saved' : 'Order created successfully',
      data,
    };
  }
}

/** confirmRefused with the catalogue's plain words, as the filters word errors[]. */
function withRefusalWording(data: MobileOrderCreateResult, lang: string): MobileOrderCreateResult {
  if (!data.confirmRefused) {
    return data;
  }
  const user = wordingFor({ ...data.confirmRefused }, lang);
  return user ? { ...data, confirmRefused: { ...data.confirmRefused, user } } : data;
}
