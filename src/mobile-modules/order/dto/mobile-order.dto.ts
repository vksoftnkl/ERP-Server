import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNotEmpty, ValidateNested } from 'class-validator';
import { OptionalUuid, RequiredUuid, TrimmedString } from 'src/common/dto/dtoDecorators';
import { SaveSaleOrderDto } from 'src/modules/sales/sale-order/dto/save-sale-order.dto';
import { SaveSaleOrderItemDto } from 'src/modules/sales/sale-order/dto/save-sale-order-item.dto';
import { MOBILE_DEVICE_UID_MAX_LENGTH } from '../../item/dto/mobile-item.dto';

/**
 * Header keys the server fills or the phone never sends: the scope and number
 * (year, device, slno / refno), the till session, the lifecycle (status, post:
 * the server confirms every phone order itself, since 2026-11-19, and
 * waOnPost: the phone path sends no WhatsApp on Post), the charge and tender
 * arrays (no advance money from a phone) and the audit names (the login is
 * the author). Sending one is a 400 VALIDATION_WHITELIST.
 */
const SERVER_FILLED_HEADER_KEYS = [
  'soId',
  'soTenantId',
  'soAccYear',
  'soSessionId',
  'soDeviceId',
  'soOrderSlno',
  'soOrderRefno',
  'soStatus',
  'post',
  'waOnPost',
  'charges',
  'tenders',
  'soCreatedBy',
  'soModifiedBy',
] as const;

/**
 * Header keys the phone may send, with rules of its own, so they are omitted
 * from the desktop DTO and declared fresh below: a redeclared prop keeps the
 * base's Swagger `required` (memory dto-redeclare-keeps-base-swagger), and
 * `declare` would drop the validation.
 */
const REDECLARED_HEADER_KEYS = ['soBranchId', 'soUserId', 'items'] as const;

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
 * Sending one of those is a 400 VALIDATION_WHITELIST. soBranchId is optional
 * here (the desktop requires it): absent = the server picks the branch.
 */
export class CreateMobileOrderDto extends OmitType(SaveSaleOrderDto, [
  ...SERVER_FILLED_HEADER_KEYS,
  ...REDECLARED_HEADER_KEYS,
] as const) {
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
      "becomes so_device_id. Without soBranchId, its branch is also the order's branch when " +
      "it belongs to soCompanyId (else the company's default branch).",
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

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'The branch the salesman picked for this order (VKSMAN Switch company), saved with the ' +
      'order on the phone. The order is saved in this branch, whatever branch the phone is ' +
      'registered to or the salesman has switched to since. It must be an active, not deleted ' +
      'branch of soCompanyId (the rows of GET /master-lookups/branches/by-company/{soCompanyId}), ' +
      'else 422 MOBILE_BRANCH_NOT_OF_COMPANY; no other branch is tried instead. Absent (or null): ' +
      "as before, the phone's branch on the Device List when it belongs to soCompanyId, else " +
      "the company's default branch, else its only active branch (422 " +
      'MOBILE_BRANCH_NOT_RESOLVED when none). A resend (same soClientUuid) answers the order ' +
      'already saved, in the branch it was saved in, whatever branch the resend carries.',
  })
  @OptionalUuid()
  soBranchId?: string;

  @ApiProperty({ type: [MobileOrderLineDto], minItems: 1, description: 'At least one line' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MobileOrderLineDto)
  items!: MobileOrderLineDto[];
}
