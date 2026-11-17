import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsNotEmpty, ValidateNested } from 'class-validator';
import {
  OptionalDateString,
  OptionalInteger,
  RequiredUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';
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
 * POST /mobile/receipts/create: the money a salesman collected from one
 * customer. Only the keys below are taken: the branch, acc year, device,
 * session, user, allocations, credits, other-ledger lines, onAccount and post
 * are the server's, and sending one is a 400 VALIDATION_WHITELIST.
 */
export class CreateMobileReceiptDto extends PickType(SaveDraftReceiptDto, [
  'avhCompanyId',
  'avhPartyId',
  'avhUsrRefno',
  'avhRemarks',
] as const) {
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
}
