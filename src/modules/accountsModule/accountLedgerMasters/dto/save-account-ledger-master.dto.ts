import { Type } from 'class-transformer';
import { LedGstPartyRegType, LedObType } from '../types/account-ledger-master-enum';
import { LedgerBankAccountItemDto } from './ledger-bank-account-item.dto';
import {
  IsArray,
  IsDate,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  NullableDate,
  NullableString,
  OptionalBoolean,
  OptionalInteger,
  OptionalUuid,
  RequiredUuid,
  SkipOnNullish,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';
import { toNullableUpperString, toUpperTrimmed } from 'src/common/dto/DtoTransforms';
export class SaveAccountLedgerMasterDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing ledger',
  })
  @OptionalUuid()
  ledId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  ledCompanyId?: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  ledBranchId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  ledGroupId!: string;

  @ApiProperty({ maxLength: 200 })
  @TrimmedString(200)
  @IsNotEmpty()
  ledName!: string;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  ledAlias?: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableString(50)
  ledShort?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableString(200)
  ledTallyName?: string | null;

  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  @NullableString(150)
  ledTallyGroupName?: string | null;

  @ApiPropertyOptional({ maxLength: 64, nullable: true })
  @NullableString(64)
  ledTallyGuid?: string | null;

  @ApiPropertyOptional({ maxLength: 30 })
  @IsOptional()
  @TrimmedString(30)
  ledCategory?: string;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  ledLedgerType?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableString(200)
  ledMailingName?: string | null;

  @ApiPropertyOptional()
  @OptionalBoolean()
  ledIsBillByBill?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  ledIsCostCenterReq?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  ledIsInterestApplicable?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  ledInterestRate?: number;

  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  @NullableString(150)
  ledContactPerson?: string | null;

  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  @IsOptional()
  @SkipOnNullish()
  @IsEmail()
  ledEmail?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  ledTel?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  ledPhone1?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  ledPhone2?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  ledWhatsappNo?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableString(200)
  ledAddr1?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableString(200)
  ledAddr2?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableString(200)
  ledAddr3?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  ledCity?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  ledDistrict?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  ledStateName?: string | null;

  @ApiPropertyOptional({ maxLength: 2, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUpperString(value))
  @SkipOnNullish()
  @TrimmedString(2)
  ledStateCode?: string | null;

  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  @NullableString(10)
  ledPin?: string | null;

  @ApiPropertyOptional({ maxLength: 60, nullable: true })
  @NullableString(60)
  ledCountry?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  ledRegionName?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableString(200)
  ledRegionAddr1?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableString(200)
  ledRegionAddr2?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableString(200)
  ledRegionAddr3?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  ledRegionCity?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  ledRegionDistrict?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  ledRegionStateName?: string | null;

  @ApiPropertyOptional({ maxLength: 60, nullable: true })
  @NullableString(60)
  ledRegionCountry?: string | null;

  @ApiPropertyOptional({
    enum: LedGstPartyRegType,
    enumName: 'LedGstPartyRegType',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }) => toNullableUpperString(value))
  @SkipOnNullish()
  @IsEnum(LedGstPartyRegType)
  ledGstPartyRegType?: LedGstPartyRegType | null;

  @ApiPropertyOptional({ maxLength: 15, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUpperString(value))
  @SkipOnNullish()
  @TrimmedString(15)
  ledGstinNo?: string | null;

  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUpperString(value))
  @SkipOnNullish()
  @TrimmedString(10)
  ledPanNo?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  ledAadharNo?: string | null;

  @ApiPropertyOptional({ maxLength: 15, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUpperString(value))
  @SkipOnNullish()
  @TrimmedString(15)
  ledEcommerceGstin?: string | null;

  @ApiPropertyOptional()
  @OptionalBoolean()
  ledIsSez?: boolean;

  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  @NullableString(10)
  ledTypeOfSupply?: string | null;

  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  @NullableString(10)
  ledHsnSac?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  ledGstRate?: number;

  @ApiPropertyOptional({ maxLength: 15, nullable: true })
  @NullableString(15)
  ledTaxability?: string | null;

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @NullableString(30)
  ledGstPartyType?: string | null;

  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUpperString(value))
  @SkipOnNullish()
  @TrimmedString(10)
  ledTanNo?: string | null;

  @ApiPropertyOptional({ maxLength: 21, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUpperString(value))
  @SkipOnNullish()
  @TrimmedString(21)
  ledCin?: string | null;

  @ApiPropertyOptional({ maxLength: 25, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUpperString(value))
  @SkipOnNullish()
  @TrimmedString(25)
  ledUdyamNo?: string | null;

  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  @NullableString(10)
  ledMsmeType?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  ledGstDutyHead?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  ledTaxRate?: number;

  @ApiPropertyOptional({ maxLength: 15, nullable: true })
  @NullableString(15)
  ledRoundingMethod?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  ledRoundingLimit?: number;

  @ApiPropertyOptional()
  @OptionalBoolean()
  ledIsTdsApplicable?: boolean;

  @ApiPropertyOptional({ maxLength: 40, nullable: true })
  @NullableString(40)
  ledTdsDeducteeType?: string | null;

  @ApiPropertyOptional({ maxLength: 80, nullable: true })
  @NullableString(80)
  ledTdsNatureOfPayment?: string | null;

  @ApiPropertyOptional()
  @OptionalBoolean()
  ledIsTcsApplicable?: boolean;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  ledObAmount?: number;

  @ApiPropertyOptional({
    enum: LedObType,
    enumName: 'LedObType',
  })
  @IsOptional()
  @Transform(({ value }) => toUpperTrimmed(value))
  @IsEnum(LedObType)
  ledObType?: LedObType;

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @NullableDate()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Type(() => Date)
  @IsDate()
  ledObAsOn?: Date | null;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  ledTotalDr?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  ledTotalCr?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  ledTotalBalance?: number;

  @ApiPropertyOptional()
  @OptionalInteger()
  ledSortOrder?: number;

  @ApiPropertyOptional()
  @OptionalBoolean()
  ledIsActive?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  ledAllowEdit?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  ledIsEntry?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  ledAllowSms?: boolean;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  ledRemarks?: string | null;

  @ApiPropertyOptional({
    type: LedgerBankAccountItemDto,
    isArray: true,
    description:
      'Bank accounts to persist alongside the ledger. On create every item is inserted; ' +
      'on update an item with `lbaId` updates that row, an item without `lbaId` is inserted. ' +
      'Omitting the array (or sending an empty one) leaves existing bank accounts untouched — ' +
      'use the dedicated delete endpoint to remove them.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LedgerBankAccountItemDto)
  ledgerBankAccount?: LedgerBankAccountItemDto[];
}
