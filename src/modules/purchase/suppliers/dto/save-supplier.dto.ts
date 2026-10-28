import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsIn, IsNotEmpty, IsOptional, Max, ValidateIf, ValidateNested } from 'class-validator';
import {
  NullableDateString,
  NullableInteger,
  NullableNumber,
  NullableString,
  NullableUpperMaxString,
  NullableUuid,
  OptionalBoolean,
  OptionalIntegerArray,
  OptionalUuid,
  RequiredUuid,
  TrimmedString,
  UpperString,
} from 'src/common/dto/dtoDecorators';
import { LedgerBankAccountItemDto } from '../../../accountsModule/accountLedgerMasters/dto/ledger-bank-account-item.dto';
import { normalizeBankAccountItems } from '../../../accountsModule/accountLedgerMasters/dto/save-account-ledger-master.dto';
export class SaveSupplierDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing supplier',
  })
  @OptionalUuid()
  supId?: string;
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Create only: make this existing PARTY ledger a supplier as well (e.g. a customer that is ' +
      'also bought from). No ledger is created; the supplier takes the ledger id as its supId, ' +
      'and the ledger keeps its group. Name, state, address, contact, GSTIN and PAN left out ' +
      'default from the ledger. 409 when the ledger is already a supplier.',
  })
  @OptionalUuid()
  supLinkLedId?: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  supCompanyId?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  supBranchId?: string | null;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  supGroupId!: string;
  @ApiProperty({ maxLength: 20 })
  @TrimmedString(20)
  @IsNotEmpty()
  supPurchaseType!: string;
  @ApiProperty({ maxLength: 200, description: 'May be left out when supLinkLedId is set' })
  @ValidateIf((o: SaveSupplierDto) => !o.supLinkLedId || Boolean(o.supName))
  @TrimmedString(200)
  @IsNotEmpty()
  supName!: string;
  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableString(50)
  supShort?: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  supAddr1?: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  supAddr2?: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  supAddr3?: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  supCity?: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  supDistrict?: string | null;
  @ApiProperty({ maxLength: 100, description: 'May be left out when supLinkLedId is set' })
  @ValidateIf((o: SaveSupplierDto) => !o.supLinkLedId || Boolean(o.supStateName))
  @TrimmedString(100)
  @IsNotEmpty()
  supStateName!: string;
  @ApiPropertyOptional({ maxLength: 60, nullable: true })
  @NullableString(60)
  supCountry?: string | null;
  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  @NullableString(10)
  supPincode?: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  supTel?: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  supPhone?: string | null;
  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  @NullableString(120)
  supMailId?: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  supWhatsappNo?: string | null;
  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableString(200)
  supWebsiteAddress?: string | null;
  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableString(200)
  supChequePreName?: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  supNotes?: string | null;
  @ApiPropertyOptional({ default: 0 })
  @NullableInteger(0)
  supCreditDays?: number;
  @ApiPropertyOptional({ default: 0 })
  @NullableNumber()
  supCashDiscPerc?: number;
  @ApiPropertyOptional({
    type: [Number],
    description: 'Collection days as integer array (JSON array or comma-separated values)',
  })
  @OptionalIntegerArray()
  supCollectionDays?: number[];
  @ApiPropertyOptional({ maxLength: 15, nullable: true })
  @NullableString(15)
  supGstNo?: string | null;
  @ApiProperty({
    minLength: 2,
    maxLength: 2,
    description: 'May be left out when supLinkLedId is set',
  })
  @ValidateIf((o: SaveSupplierDto) => !o.supLinkLedId || Boolean(o.supStateCode))
  @UpperString(2)
  supStateCode!: string;
  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  @NullableString(10)
  supPanNo?: string | null;
  @ApiProperty({ maxLength: 30 })
  @TrimmedString(30)
  @IsNotEmpty()
  supGstType!: string;
  @ApiPropertyOptional({ maxLength: 25, nullable: true })
  @NullableString(25)
  supSupCst?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  supDrugLiscenceNo?: string | null;
  // MST-01 purchase fields (plan-purchase-phase1 §2.5) — MSME 15 / 45-day rule, licences, notes popup
  @ApiPropertyOptional({ nullable: true, description: 'Drug licence valid to (YYYY-MM-DD).' })
  @NullableDateString()
  supDrugLicenceExpiry?: string | null;
  @ApiPropertyOptional({ maxLength: 10, nullable: true, enum: ['MICRO', 'SMALL', 'MEDIUM', 'NONE'] })
  @NullableUpperMaxString(10)
  @IsIn(['MICRO', 'SMALL', 'MEDIUM', 'NONE', null])
  supMsmeCategory?: string | null;
  @ApiPropertyOptional({ maxLength: 15, nullable: true, enum: ['MANUFACTURER', 'SERVICE', 'TRADER'] })
  @NullableUpperMaxString(15)
  @IsIn(['MANUFACTURER', 'SERVICE', 'TRADER', null])
  supMsmeActivity?: string | null;
  @ApiPropertyOptional({ description: 'Written agreement with the MSME supplier: agreed days apply (max 45), else 15.' })
  @OptionalBoolean()
  supMsmeAgreement?: boolean;
  @ApiPropertyOptional({ nullable: true, minimum: 0, maximum: 45 })
  @NullableInteger(0)
  @Max(45)
  supMsmeAgreedDays?: number | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  supFssaiNo?: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'FSSAI licence valid to (YYYY-MM-DD).' })
  @NullableDateString()
  supFssaiValidTo?: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Godown a bill from this supplier opens with.' })
  @NullableUuid()
  supDefaultGodownId?: string | null;
  @ApiPropertyOptional({ description: 'Pop the supplier note up when the supplier is picked on an entry screen.' })
  @OptionalBoolean()
  supShowNotesOnEntry?: boolean;
  @ApiPropertyOptional({ description: 'Import / overseas supplier.' })
  @OptionalBoolean()
  supIsImport?: boolean;
  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableString(200)
  supRegionName?: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  supRegionAddr1?: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  supRegionAddr2?: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  supRegionAddr3?: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  supRegionCity?: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  supRegionDistrict?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  supRegionStateName?: string | null;
  @ApiPropertyOptional({ maxLength: 60, nullable: true })
  @NullableString(60)
  supRegionCountry?: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'date' })
  @NullableDateString()
  supBilledDate?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableInteger()
  supSortOrder?: number | null;
  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  supIsActive?: boolean;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  supCreatedBy?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  supModifiedBy?: string | null;

  @ApiPropertyOptional({
    type: LedgerBankAccountItemDto,
    isArray: true,
    description:
      "Bank accounts to persist on the supplier's linked account ledger. On create every item " +
      'is inserted; on update an item with `lbaId` updates that row, an item without `lbaId` is ' +
      'inserted. Omitting the array (or sending an empty one) leaves existing bank accounts ' +
      'untouched — use the ledger bank account delete endpoint to remove them.',
  })
  @IsOptional()
  @Transform(({ value }) => normalizeBankAccountItems(value))
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LedgerBankAccountItemDto)
  ledgerBankAccount?: LedgerBankAccountItemDto[];
}
