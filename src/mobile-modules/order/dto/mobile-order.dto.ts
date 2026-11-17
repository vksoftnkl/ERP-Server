import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNotEmpty, ValidateNested } from 'class-validator';
import { OptionalUuid, RequiredUuid, TrimmedString } from 'src/common/dto/dtoDecorators';
import { SaveSaleOrderDto } from 'src/modules/sales/sale-order/dto/save-sale-order.dto';
import { SaveSaleOrderItemDto } from 'src/modules/sales/sale-order/dto/save-sale-order-item.dto';
import { MOBILE_DEVICE_UID_MAX_LENGTH } from '../../item/dto/mobile-item.dto';

/**
 * Header keys the server fills or the phone never sends: the scope and number
 * (branch, year, device, slno / refno), the till session, the lifecycle
 * (status, post: a phone order is saved DRAFT and confirmed in the office),
 * the charge and tender arrays (no advance money from a phone), the audit
 * names (the login is the author), and soUserId / items, declared fresh below
 * (a redeclared prop keeps the base's Swagger `required`).
 */
const SERVER_FILLED_HEADER_KEYS = [
  'soId',
  'soBranchId',
  'soTenantId',
  'soAccYear',
  'soSessionId',
  'soDeviceId',
  'soOrderSlno',
  'soOrderRefno',
  'soStatus',
  'post',
  'charges',
  'tenders',
  'soCreatedBy',
  'soModifiedBy',
  'soUserId',
  'items',
] as const;

/** Line keys the order fills from its own header, or that only an update sends. */
const SERVER_FILLED_LINE_KEYS = [
  'soiId',
  'soiOrderId',
  'soiCompanyId',
  'soiBranchId',
  'soiTenantId',
  'soiAccYear',
  'soiCreatedBy',
  'soiModifiedBy',
] as const;

/** One order line: the desktop line payload without its scope keys. */
export class MobileOrderLineDto extends OmitType(SaveSaleOrderItemDto, SERVER_FILLED_LINE_KEYS) {}

/**
 * POST /mobile/orders/create: one order with its lines, in the desktop
 * /sale-orders/create shape (so* / soi*) without the keys the server fills.
 * Sending one of those is a 400 VALIDATION_WHITELIST.
 */
export class CreateMobileOrderDto extends OmitType(SaveSaleOrderDto, SERVER_FILLED_HEADER_KEYS) {
  @ApiProperty({
    format: 'uuid',
    description:
      "The phone's own id for this order. Send the same one again after a lost answer: the " +
      'order already saved is answered (duplicate: true), never a second one.',
  })
  @RequiredUuid()
  soClientUuid!: string;

  @ApiProperty({
    maxLength: MOBILE_DEVICE_UID_MAX_LENGTH,
    description:
      "The phone's registered device uid (fixed.device_master.dev_device_uid). Its device " +
      "becomes so_device_id, and its branch the order's branch when it belongs to soCompanyId " +
      "(else the company's default branch).",
  })
  @TrimmedString(MOBILE_DEVICE_UID_MAX_LENGTH)
  @IsNotEmpty()
  deviceUid!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      "The salesman's user id. Ignored when the upload carries a token: the login user is " +
      'so_user_id then. Required without one.',
  })
  @OptionalUuid()
  soUserId?: string;

  @ApiProperty({ type: [MobileOrderLineDto], minItems: 1, description: 'At least one line' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MobileOrderLineDto)
  items!: MobileOrderLineDto[];
}
