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
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { API_VERSION } from '../../common/constants/api-version';
import { OptionalAuth } from '../../common/decorators/optional-auth.decorator';
import { HttpErrorResponseDto } from '../../common/dto/http-error-response.dto';
import { DataChangeService } from '../../common/data-changes/data-change.service';
import { SaleOrderExceptionFilter } from '../../modules/sales/sale-order/sale-order-exception.filter';
import { SaleOrderErrorResponseDto } from '../../modules/sales/sale-order/dto/sale-order-response.dto';
import { CreateMobileOrderDto } from './dto/mobile-order.dto';
import { MobileOrderService } from './mobile-order.service';
import type { MobileOrderCreateResult } from './types/mobile-order-api.types';

type SessionRequest = { user?: { sid?: string | null } };

class MobileOrderCreateResultDto {
  @ApiProperty({ format: 'uuid' }) soId!: string;
  @ApiProperty({ example: 'sor00042' }) soOrderRefno!: string;
  @ApiProperty({
    example: 'DRAFT',
    description: 'Now: DRAFT when just saved; a resend reads the stored one',
  })
  soStatus!: string;
  @ApiProperty({ example: '2026-2027' }) soAccYear!: string;
  @ApiProperty({ description: 'true = saved before under this soClientUuid; nothing written now' })
  duplicate!: boolean;
  @ApiProperty({ description: 'A resend of an order the office has since deleted' })
  soIsDeleted!: boolean;
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
      'The desktop /sale-orders/create payload (so* / soi*) without soId, soBranchId, ' +
      'soAccYear, soDeviceId, soOrderSlno / soOrderRefno, soSessionId, soStatus, post, ' +
      'charges and tenders (400 VALIDATION_WHITELIST), plus soClientUuid and deviceUid. The ' +
      'server fills: the device (the registered phone, 403 MOBILE_DEVICE_*), the branch (the ' +
      "phone's when it belongs to soCompanyId, else the company default; 422 " +
      "MOBILE_BRANCH_NOT_RESOLVED), the acc year (the company's financial year holding " +
      'soOrderDate, today when omitted; 422 MOBILE_NO_FISCAL_YEAR) and the number (voucher ' +
      'type 4). Saved DRAFT; the office confirms. The same soClientUuid again answers the ' +
      'order already saved (duplicate: true) and writes nothing; on another customer it is a ' +
      '409 MOBILE_CLIENT_UUID_REUSED.',
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
    const data = await this.mobileOrderService.create(dto);
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
