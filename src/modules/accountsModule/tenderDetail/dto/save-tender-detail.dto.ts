import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import {
  NullableDateString,
  NullableNumber,
  NullableStringStrict,
  NullableUuid,
  OptionalBoolean,
  OptionalDateString,
  OptionalInteger,
  OptionalNumber,
  OptionalUpperMaxString,
  OptionalUuid,
} from 'src/common/dto/dtoDecorators';
import {
  TenderDrCr,
  TenderSettleStatus,
  TenderSrcDocType,
  TenderSrcModule,
} from '../types/tender-detail-api.types';
// One acc_tender_detail row. Nothing is required by the decorators: a create
// needs the document scope plus tdTenderId, an update needs only tdId and the
// fields that change, so "required on create" is enforced in the service
// (TenderDetailService.requireField) where the stored row and the parent
// document's scope are available to fill the gaps.
export class SaveTenderDetailDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, updates that tender line; otherwise a new line is created',
  })
  @OptionalUuid()
  tdId?: string;

  @ApiPropertyOptional({
    enum: TenderSrcModule,
    enumName: 'TenderSrcModule',
    description:
      'Module that raised the parent document. Required on create, immutable afterwards; ' +
      'inherited from the parent when tendered as part of a document save',
  })
  @OptionalUpperMaxString(20)
  @IsEnum(TenderSrcModule)
  tdSrcModule?: TenderSrcModule;

  @ApiPropertyOptional({
    enum: TenderSrcDocType,
    enumName: 'TenderSrcDocType',
    description: 'Kind of parent document. Required on create, immutable afterwards',
  })
  @OptionalUpperMaxString(30)
  @IsEnum(TenderSrcDocType)
  tdSrcDocType?: TenderSrcDocType;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Parent document id (polymorphic, no FK). Required on create, immutable afterwards',
  })
  @OptionalUuid()
  tdSrcDocId?: string;

  @ApiPropertyOptional({
    minimum: 1,
    description: 'Line order within the document. Defaults to the 1-based position in the array',
  })
  @OptionalInteger(1)
  tdRowNo?: number;

  @ApiPropertyOptional({ format: 'uuid', description: 'Required on create' })
  @OptionalUuid()
  tdCompanyId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Required on create' })
  @OptionalUuid()
  tdBranchId?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  tdTenantId?: string | null;

  @ApiPropertyOptional({
    minLength: 9,
    maxLength: 9,
    description:
      'Accounting year, e.g. 2026-2027. Required on create (the table is partitioned by it)',
  })
  @NullableStringStrict(9)
  tdAccYear?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'date',
    description: "Snapshot of the parent document's date. Required on create",
  })
  @OptionalDateString()
  tdDocDate?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Customer / supplier ledger the document is raised against. Required on create',
  })
  @OptionalUuid()
  tdPartyLedgerId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'accounts.acc_voucher_header — filled at posting, null on a draft document',
  })
  @NullableUuid()
  tdVoucherId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'acc_tender_master.tndId — what the operator picked. Required on create',
  })
  @OptionalUuid()
  tdTenderId?: string;

  @ApiPropertyOptional({
    description:
      'Snapshot of acc_tender_master.tndTypeId (integer, carried as a string). Defaults to the ' +
      "tender master's own type",
  })
  @OptionalNumber()
  tdTenderTypeId?: string | number;

  @ApiPropertyOptional({
    format: 'uuid',
    description: "Posting ledger snapshot. Defaults to the tender master's tndLedgerId",
  })
  @OptionalUuid()
  tdTenderLedgerId?: string;

  @ApiPropertyOptional({
    enum: TenderDrCr,
    enumName: 'TenderDrCr',
    description: 'Money in (DR) or out (CR). Inherited from the parent document when omitted',
  })
  @OptionalUpperMaxString(2)
  @IsEnum(TenderDrCr)
  tdDrCr?: TenderDrCr;

  @ApiPropertyOptional({ minimum: 0, description: 'Tendered amount before surcharge' })
  @OptionalNumber(0)
  tdAmount?: string | number;

  @ApiPropertyOptional({ minimum: 0 })
  @OptionalNumber(0)
  tdSurchargePerc?: string | number;

  @ApiPropertyOptional({ minimum: 0 })
  @OptionalNumber(0)
  tdSurchargeAmt?: string | number;

  @ApiPropertyOptional({
    minimum: 0,
    description: 'tdAmount + tdSurchargeAmt, rounded to 2 decimals. Computed when omitted',
  })
  @OptionalNumber(0)
  tdTotalAmt?: string | number;

  @ApiPropertyOptional({ minimum: 0, description: 'Cash that hit the drawer' })
  @OptionalNumber(0)
  tdReceivedAmt?: string | number;

  @ApiPropertyOptional({ minimum: 0, description: 'Change handed back' })
  @OptionalNumber(0)
  tdChangeAmt?: string | number;

  @ApiPropertyOptional({ minimum: 0, description: 'Loyalty points / voucher units spent' })
  @OptionalNumber(0)
  tdUnitsUsed?: string | number;

  @ApiPropertyOptional({ description: 'Units to currency; must be greater than 0' })
  @OptionalNumber()
  tdConversionRate?: string | number;

  @ApiPropertyOptional({
    maxLength: 100,
    nullable: true,
    description: 'UPI txn id / card RRN / cheque no',
  })
  @NullableStringStrict(100)
  tdRefNo?: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableStringStrict(50)
  tdAuthCode?: string | null;

  @ApiPropertyOptional({ maxLength: 4, nullable: true, description: 'Exactly 4 digits' })
  @NullableStringStrict(4)
  tdCardLast4?: string | null;

  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  @NullableStringStrict(150)
  tdBankName?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true, description: 'UPI payer handle' })
  @NullableStringStrict(100)
  tdPayerVpa?: string | null;

  @ApiPropertyOptional({
    type: 'string',
    format: 'date',
    nullable: true,
    description: 'Cheque date; required when tdIsPdc is true',
  })
  @NullableDateString()
  tdInstrumentDate?: string | null;

  @ApiPropertyOptional({ default: false, description: 'Post-dated cheque' })
  @OptionalBoolean()
  tdIsPdc?: boolean;

  @ApiPropertyOptional({
    enum: TenderSettleStatus,
    enumName: 'TenderSettleStatus',
    default: TenderSettleStatus.NA,
  })
  @OptionalUpperMaxString(20)
  @IsEnum(TenderSettleStatus)
  tdSettleStatus?: TenderSettleStatus;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Clearing ledger snapshot' })
  @NullableUuid()
  tdSettleLedgerId?: string | null;

  @ApiPropertyOptional({ type: 'string', format: 'date', nullable: true })
  @NullableDateString()
  tdExpectedSettleOn?: string | null;

  @ApiPropertyOptional({
    type: 'string',
    format: 'date',
    nullable: true,
    description: 'Required when tdSettleStatus is SETTLED',
  })
  @NullableDateString()
  tdSettledOn?: string | null;

  @ApiPropertyOptional({ minimum: 0, nullable: true, description: 'Net credited by the acquirer' })
  @NullableNumber(0)
  tdSettleAmount?: string | number | null;

  @ApiPropertyOptional({ minimum: 0 })
  @OptionalNumber(0)
  tdMdrAmt?: string | number;

  @ApiPropertyOptional({ maxLength: 100, nullable: true, description: 'Bank batch / UTR' })
  @NullableStringStrict(100)
  tdSettleRefNo?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'JV that moved clearing to bank',
  })
  @NullableUuid()
  tdSettleVoucherId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  tdSessionId?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  tdDeviceId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Who tendered. Required on create; inherited from the parent document',
  })
  @OptionalUuid()
  tdUserId?: string;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  tdNotes?: string | null;

  // td_created_by / td_modified_by are varchar(50), not uuid: the actor is
  // whatever resolveActor settles on — a user id, but equally a name or login
  // the caller passed.
  @ApiPropertyOptional({
    maxLength: 50,
    nullable: true,
    description: 'Actor id or name; defaults to the caller',
  })
  @NullableStringStrict(50)
  tdCreatedBy?: string | null;

  @ApiPropertyOptional({
    maxLength: 50,
    nullable: true,
    description: 'Actor id or name; defaults to the caller',
  })
  @NullableStringStrict(50)
  tdModifiedBy?: string | null;
}
