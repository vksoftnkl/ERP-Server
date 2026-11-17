import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { RequiredUuid, TrimmedString } from 'src/common/dto/dtoDecorators';
import { SaveBillDto } from 'src/modules/sales/bill/dto/save-bill.dto';
import { SaveBillItemDto } from 'src/modules/sales/bill/dto/save-bill-item.dto';
import { MOBILE_DEVICE_UID_MAX_LENGTH } from '../../item/dto/mobile-item.dto';

/** A phone bill is a credit bill: it carries no tenders (user's decision, 2026-11-17). */
export const MOBILE_BILL_TYPE = 'CREDIT';

/**
 * Header keys the server fills or a phone bill does not carry:
 *  - the scope and the number: id, branch, tenant, acc year, slno / refno;
 *  - the till and the device: session, counter, device type and id;
 *  - the lifecycle: status, post (a phone bill is always saved AND posted),
 *    the posted voucher, the doc register, approval, cancel reason, revision
 *    and the other server-owned caches;
 *  - the money arrays: tenders (a credit bill), charges, adjustments;
 *  - the audit names and sbUserId (the login is the author);
 *  - sbBillMode: a phone bill is WHOLESALE (the column default), so it takes
 *    the branch's Sales Bill series, never a POS device series;
 *  - the source-document keys: a phone bill is raised from no order or
 *    challan;
 *  - sbBillType and items, declared fresh below (a redeclared prop keeps the
 *    base's Swagger, memory dto-redeclare-keeps-base-swagger).
 */
const SERVER_FILLED_HEADER_KEYS = [
  'sbId',
  'sbBranchId',
  'sbTenantId',
  'sbAccYear',
  'sbSessionId',
  'sbCounterId',
  'sbDeviceType',
  'sbDeviceId',
  'sbBillSlno',
  'sbBillRefno',
  'sbBillMode',
  'sbStatus',
  'post',
  'sbPostedVoucherId',
  'sbDocRegisterId',
  'sbApprovedOn',
  'sbApprovedBy',
  'sbCancelReason',
  'sbVersionNo',
  'sbPrintCount',
  'sbRevisionNo',
  'sbCogsAmt',
  'sbDeliveryStatus',
  'sbLoyaltyEarned',
  'sbLoyaltyRedeemed',
  'sbReturnedAmt',
  'sbReturnStatus',
  'sbHasDc',
  'sbSrcDocType',
  'sbSrcDocId',
  'sbSrcDocRefno',
  'sbSrcDocDate',
  'sbSrcDocYear',
  'tenders',
  'charges',
  'adjustments',
  'sbCreatedBy',
  'sbModifiedBy',
  'sbUserId',
  'sbBillType',
  'items',
] as const;

/**
 * Line keys the bill fills from its own header, that only an update sends, or
 * that name a source document (a phone bill has none).
 */
const SERVER_FILLED_LINE_KEYS = [
  'sbiId',
  'sbiBillId',
  'sbiCompanyId',
  'sbiBranchId',
  'sbiTenantId',
  'sbiAccYear',
  'sbiCogsAmt',
  'sbiSrcDocType',
  'sbiSrcDocId',
  'sbiSrcDocYear',
  'sbiSrcDocRefno',
  'sbiSrcDocLineNo',
  'sbiSrcItemQty',
  'sbiSrcFreeQty',
  'sbiSrcItemId',
  'sbiCreatedBy',
  'sbiModifiedBy',
] as const;

/**
 * One bill line: the desktop line payload without its scope and source keys.
 * sbiGodownId stays REQUIRED, as on the desktop: the salesman picks the godown
 * (GET /mobile/bills/options lists the ones the bill may draw on).
 */
export class MobileBillLineDto extends OmitType(SaveBillItemDto, SERVER_FILLED_LINE_KEYS) {}

/**
 * POST /mobile/bills/create: one bill with its lines, in the desktop
 * /bills/create shape (sb* / sbi*) without the keys the server fills. Sending
 * one of those is a 400 VALIDATION_WHITELIST.
 */
export class CreateMobileBillDto extends OmitType(SaveBillDto, SERVER_FILLED_HEADER_KEYS) {
  @ApiProperty({
    format: 'uuid',
    description:
      "The phone's own id for this bill. Send the same one again after a lost answer: the bill " +
      'already saved is answered (duplicate: true), never a second one.',
  })
  @RequiredUuid()
  sbClientUuid!: string;

  @ApiProperty({
    maxLength: MOBILE_DEVICE_UID_MAX_LENGTH,
    description:
      "The phone's registered device uid (fixed.device_master.dev_device_uid). Its dev_id " +
      "becomes sb_device_id, and its branch the bill's branch when it belongs to sbCompanyId " +
      "(else the company's default branch).",
  })
  @TrimmedString(MOBILE_DEVICE_UID_MAX_LENGTH)
  @IsNotEmpty()
  deviceUid!: string;

  @ApiPropertyOptional({
    enum: [MOBILE_BILL_TYPE],
    default: MOBILE_BILL_TYPE,
    description:
      'A phone bill is a CREDIT bill (no tenders): the whole amount stays on the customer. ' +
      'Omitted = CREDIT.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsIn([MOBILE_BILL_TYPE])
  sbBillType?: string;

  @ApiProperty({ type: [MobileBillLineDto], minItems: 1, description: 'At least one line' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MobileBillLineDto)
  items!: MobileBillLineDto[];
}

/** GET /mobile/bills/options */
export class MobileBillOptionsQueryDto {
  @ApiProperty({ format: 'uuid', description: 'The company the bill is for' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({
    maxLength: MOBILE_DEVICE_UID_MAX_LENGTH,
    description:
      "The phone's registered device uid. The branch is resolved from it exactly as an " +
      'upload resolves it.',
  })
  @TrimmedString(MOBILE_DEVICE_UID_MAX_LENGTH)
  @IsNotEmpty()
  deviceUid!: string;
}
