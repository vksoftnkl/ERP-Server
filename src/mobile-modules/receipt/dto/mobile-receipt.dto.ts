import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import {
  OptionalDateString,
  OptionalInteger,
  OptionalNumber,
  OptionalQueryBoolean,
  OptionalUuid,
  RequiredUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';
import {
  PostReceiptAllocationDto,
  PostReceiptCreditDto,
} from 'src/modules/accountsModule/receipt/dto/post-receipt.dto';
import {
  SaveDraftReceiptDto,
  SaveReceiptTenderDto,
} from 'src/modules/accountsModule/receipt/dto/save-receipt.dto';
import { MOBILE_DEVICE_UID_MAX_LENGTH } from '../../item/dto/mobile-item.dto';

/**
 * One instrument the salesman collected: the desktop tender row's keys the
 * phone needs and nothing else. tdRowNo is the row's position (the server
 * numbers them 1, 2, …); the ledger, the surcharge, MDR, change and
 * authorisation are the tender master's, as on a desktop receipt that leaves
 * them out. A card's last 4 ride in tdRefNo (4 digits).
 */
export class MobileReceiptTenderDto extends PickType(SaveReceiptTenderDto, [
  'tdTenderId',
  'tdTenderTypeId',
  'tdAmount',
  'tdRefNo',
  'tdBankName',
  'tdInstrumentDate',
  'cheque',
] as const) {}

/**
 * One bill the phone's receipt settles (VKSMAN receipt, canvas 5b, 2026-11-19):
 * /receipts/post's allocation row less the write-off, which a phone may not
 * give (writeoff / writeoffApprovedBy are a 400 VALIDATION_WHITELIST).
 * `amount` is money and credits together, excluding the discount and the
 * round-off, as on the desktop. The server caps it at what the bill can take
 * now (D1); the discount may not exceed the prompt-payment suggestion for the
 * receipt's date (D4) and the round-off may not exceed 0.99 (D5).
 */
export class MobileReceiptAllocationDto extends PickType(PostReceiptAllocationDto, [
  'billId',
  'billAccYear',
  'amount',
  'discount',
  'roundoff',
] as const) {}

/** One credit the phone's receipt spends: /receipts/post's creditsApplied row. Capped at what it holds now (D1). */
export class MobileReceiptCreditDto extends PickType(PostReceiptCreditDto, [
  'billId',
  'billAccYear',
  'amount',
] as const) {}

/**
 * POST /mobile/receipts/create: the money a salesman collected from one
 * customer. Only the keys below are taken: the acc year, device, session,
 * user, collector, other-ledger lines, otherLineBills, post and replace are the
 * server's, and sending one is a 400 VALIDATION_WHITELIST.
 *
 * Without allocations and creditsApplied (older phones) the server fills the
 * open bills oldest first, as before. With either, the phone's own settlement
 * is posted, adjusted to the bills as they stand now (D1).
 */
export class CreateMobileReceiptDto extends PickType(SaveDraftReceiptDto, [
  'avhCompanyId',
  'avhPartyId',
  'avhUsrRefno',
  'avhRemarks',
  'avhDocRefno',
  'avhDocDate',
] as const) {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      "The branch picked in the phone's Switch company. It must be an active, live branch of " +
      'avhCompanyId (422 MOBILE_BRANCH_NOT_OF_COMPANY); no other branch is tried instead. ' +
      "Omitted: the phone's Device List branch when it is the company's, else the company " +
      'default, else its only branch.',
  })
  @OptionalUuid()
  avhBranchId?: string;

  @ApiPropertyOptional({
    type: [MobileReceiptAllocationDto],
    description:
      "The phone's settlement, in the order the money fills the bills (open-items order). " +
      'Send it (or creditsApplied) to settle bills the phone chose; omit both and the server ' +
      'fills the open bills oldest first, as for older phones. [] = everything on account.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => MobileReceiptAllocationDto)
  allocations?: MobileReceiptAllocationDto[];

  @ApiPropertyOptional({
    type: [MobileReceiptCreditDto],
    description:
      'Credits the customer holds that this receipt spends (ADVANCE / SALES_RETURN / OPENING_CR ' +
      '/ JOURNAL_CR rows of GET /mobile/receipts/open-bills?withCredits=true). A credit lands ' +
      'on bills only, never on account.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => MobileReceiptCreditDto)
  creditsApplied?: MobileReceiptCreditDto[];

  @ApiPropertyOptional({
    minimum: 0,
    example: 0,
    description:
      "The phone's own on-account figure. Informational only: never refused on a mismatch, " +
      "the server's figure (the answer's onAccount) wins.",
  })
  @OptionalNumber(0)
  onAccount?: number;

  @ApiProperty({
    format: 'uuid',
    description:
      "The phone's own id for this receipt. Send the same one again after a lost answer: the " +
      'receipt already saved is answered (duplicate: true), never a second one.',
  })
  @RequiredUuid()
  avhClientUuid!: string;

  @ApiProperty({
    maxLength: MOBILE_DEVICE_UID_MAX_LENGTH,
    description:
      "The phone's registered device uid (fixed.device_master.dev_device_uid). Its dev_id is " +
      "the receipt's device, and its branch the receipt's branch when it belongs to " +
      "avhCompanyId (else the company's default branch).",
  })
  @TrimmedString(MOBILE_DEVICE_UID_MAX_LENGTH)
  @IsNotEmpty()
  deviceUid!: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'date',
    example: '2026-11-17',
    description: "The receipt's date (YYYY-MM-DD). Omitted = today (the server's IST date).",
  })
  @OptionalDateString()
  avhVoucherDate?: string;

  @ApiProperty({
    type: [MobileReceiptTenderDto],
    minItems: 1,
    description: 'At least one instrument; each must carry more than zero',
  })
  // Listed bottom-up so a missing array reports VALIDATION_IS_ARRAY first.
  @ArrayMaxSize(100)
  @ArrayMinSize(1)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MobileReceiptTenderDto)
  tenders!: MobileReceiptTenderDto[];
}

/** GET /mobile/receipts/options */
export class MobileReceiptOptionsQueryDto {
  @ApiProperty({ format: 'uuid', description: 'The company the money is collected for' })
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

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      "The branch picked in the phone's Switch company (the upload's avhBranchId): its tenders " +
      'are listed. Must be an active, live branch of companyId (422 MOBILE_BRANCH_NOT_OF_COMPANY). ' +
      'Omitted: resolved from the device as an upload without avhBranchId resolves it.',
  })
  @OptionalUuid()
  branchId?: string;
}

export const MOBILE_OPEN_BILLS_DEFAULT_PAGE_SIZE = 200;
export const MOBILE_OPEN_BILLS_MAX_PAGE_SIZE = 500;

/** GET /mobile/receipts/open-bills */
export class MobileOpenBillsQueryDto {
  @ApiProperty({ format: 'uuid', description: "The company whose customers' open bills are read" })
  @RequiredUuid()
  companyId!: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @OptionalInteger(1)
  page?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MOBILE_OPEN_BILLS_MAX_PAGE_SIZE,
    default: MOBILE_OPEN_BILLS_DEFAULT_PAGE_SIZE,
  })
  @OptionalInteger(1, MOBILE_OPEN_BILLS_MAX_PAGE_SIZE)
  pageSize?: number;

  @ApiPropertyOptional({
    default: false,
    description:
      'true = the credits each customer holds come in the same list (kind ADVANCE, ' +
      'SALES_RETURN, OPENING_CR or JOURNAL_CR, pendingAmount = what is held), after that ' +
      "customer's bills; total and the pages then count them too. Omitted / false = bills only, " +
      'exactly as older phones read the list.',
  })
  @OptionalQueryBoolean()
  withCredits?: boolean;
}

export const MOBILE_RECEIPT_STATUS_DEFAULT_PAGE_SIZE = 200;
export const MOBILE_RECEIPT_STATUS_MAX_PAGE_SIZE = 500;

/** GET /mobile/receipts/status */
export class MobileReceiptStatusQueryDto {
  @ApiProperty({
    format: 'uuid',
    description: 'The company whose receipts from this phone are read',
  })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({
    maxLength: MOBILE_DEVICE_UID_MAX_LENGTH,
    description:
      "The phone's registered device uid: only the receipts uploaded from this phone " +
      '(avh_device_id = its dev_id, with a client uuid) are read.',
  })
  @TrimmedString(MOBILE_DEVICE_UID_MAX_LENGTH)
  @IsNotEmpty()
  deviceUid!: string;

  @ApiPropertyOptional({
    example: '2026-11-19T10:15:00.000Z',
    description:
      'Only receipts changed at or after this instant (ISO 8601; send the asOf of the last ' +
      'read). Omitted: all of them.',
  })
  @OptionalDateString()
  since?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @OptionalInteger(1)
  page?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MOBILE_RECEIPT_STATUS_MAX_PAGE_SIZE,
    default: MOBILE_RECEIPT_STATUS_DEFAULT_PAGE_SIZE,
  })
  @OptionalInteger(1, MOBILE_RECEIPT_STATUS_MAX_PAGE_SIZE)
  pageSize?: number;
}
