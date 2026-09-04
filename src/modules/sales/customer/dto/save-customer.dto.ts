import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import {
  NullableDateString,
  NullableInteger,
  NullableNumber,
  NullableStringStrict,
  NullableUuid,
  OptionalBoolean,
  OptionalIntegerArray,
  OptionalUuid,
  RequiredInteger,
  RequiredUuid,
  TrimmedString,
  UpperString,
} from 'src/common/dto/dtoDecorators';

export class SaveCustomerDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing customer',
  })
  @OptionalUuid()
  cusId?: string;

  @ApiPropertyOptional({ maxLength: 5, nullable: true })
  @NullableStringStrict(5)
  cusTitle?: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableStringStrict(50)
  cusShort?: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableStringStrict(50)
  cusCode?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableStringStrict(200)
  cusName?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  cusAddr1?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  cusAddr2?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  cusAddr3?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  cusCity?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  cusDistrict?: string | null;

  @ApiProperty({ maxLength: 100 })
  @TrimmedString(100)
  @IsNotEmpty()
  cusStateName!: string;

  @ApiPropertyOptional({ maxLength: 60, nullable: true })
  @NullableStringStrict(60)
  cusCountry?: string | null;

  @ApiProperty({ minLength: 2, maxLength: 2 })
  @UpperString(2)
  cusStateCode!: string;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableStringStrict(200)
  cusLandmark?: string | null;

  @ApiPropertyOptional({ maxLength: 6, nullable: true })
  @NullableStringStrict(6)
  cusPin?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  cusTel?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  cusPhone1?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  cusPhone2?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  cusWhatsappNo?: string | null;

  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  @NullableStringStrict(120)
  cusEmail?: string | null;

  @ApiPropertyOptional({ maxLength: 12, nullable: true })
  @NullableStringStrict(12)
  cusAadharNo?: string | null;

  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  @NullableStringStrict(150)
  cusContactPerson?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableInteger(0)
  cusDistanceKm?: number | null;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  cusCreditAllowed?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @NullableInteger(0)
  cusCreditBillLimit?: number;

  @ApiPropertyOptional({ default: 0 })
  @NullableNumber()
  cusCreditAmtLimit?: number;

  @ApiPropertyOptional({ default: 0 })
  @NullableInteger(0)
  cusCreditDays?: number;

  @ApiPropertyOptional({ default: 0 })
  @NullableNumber()
  cusDebitBalance?: number;

  @ApiPropertyOptional({ default: 0 })
  @NullableNumber()
  cusDiscPerc?: number;

  @ApiPropertyOptional({ default: 0 })
  @NullableInteger(0)
  cusDebitGraceDays?: number;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  cusEnableSms?: boolean;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  cusOverdueSms?: boolean;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  cusOverdueBilling?: boolean;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  cusAllowPromotion?: boolean;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  cusAllowLoyalty?: boolean;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  cusAllowDiscount?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @NullableInteger(0)
  cusSortOrder?: number;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableStringStrict(200)
  cusRegionName?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  cusRegionAddr1?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  cusRegionAddr2?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  cusRegionAddr3?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  cusRegionCity?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  cusRegionDistrict?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  cusRegionStateName?: string | null;

  @ApiPropertyOptional({ maxLength: 60, nullable: true })
  @NullableStringStrict(60)
  cusRegionCountry?: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'date' })
  @NullableDateString()
  cusBirthDate?: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'date' })
  @NullableDateString()
  cusMarriageDate?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableStringStrict(200)
  cusTransportName?: string | null;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  cusFreightCharge?: boolean;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  cusLoadingCharge?: boolean;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  cusUnloadingCharge?: boolean;

  @ApiPropertyOptional({ maxLength: 15, nullable: true })
  @NullableStringStrict(15)
  cusGstNo?: string | null;

  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  @NullableStringStrict(10)
  cusPanNo?: string | null;

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @NullableStringStrict(30)
  cusGstType?: string | null;

  @ApiPropertyOptional({ maxLength: 15, nullable: true })
  @NullableStringStrict(15)
  cusEcommerceGstin?: string | null;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  cusTcsApplicable?: boolean;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  cusItcollExempted?: boolean;

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @NullableStringStrict(30)
  cusItcollType?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableStringStrict(200)
  cusGeoLocation?: string | null;

  @ApiPropertyOptional({
    type: [Number],
    description: 'Collection days as integer array (JSON array or comma-separated values)',
  })
  @OptionalIntegerArray()
  cusCollectionDays?: number[];

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  cusDefaultSalesman?: string | null;

  @ApiProperty({ minimum: 0 })
  @RequiredInteger(0)
  cusPriceLevelId!: number;

  @ApiPropertyOptional({ nullable: true, format: 'date' })
  @NullableDateString()
  cusBilledDate?: string | null;

  @ApiPropertyOptional({ default: 0 })
  @NullableInteger(0)
  cusBilledCount?: number;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  cusNotes?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  cusCompanyId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  cusBranchId?: string | null;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  cusAreaId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  cusGroupId!: string;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  cusIsActive?: boolean;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  cusCreatedBy?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  cusModifiedBy?: string | null;
}
