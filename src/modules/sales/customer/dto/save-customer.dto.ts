import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, Max, ValidateIf } from 'class-validator';
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
import {
  NullableUpperPattern,
  PARTY_GSTIN_PATTERN,
  PARTY_GSTIN_PATTERNS,
  PARTY_PAN_PATTERN,
  gstinKindOf,
  type PartyGstinKind,
} from 'src/common/party/party-gstin';

// The GSTIN / PAN shapes live in src/common/party/party-gstin.ts (shared with the supplier).
export const CUSTOMER_GSTIN_PATTERNS = PARTY_GSTIN_PATTERNS;
export type CustomerGstinKind = PartyGstinKind;
export const CUSTOMER_GSTIN_PATTERN = PARTY_GSTIN_PATTERN;
export const CUSTOMER_PAN_PATTERN = PARTY_PAN_PATTERN;
export { gstinKindOf };

export class SaveCustomerDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing customer',
  })
  @OptionalUuid()
  cusId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Create only: make this existing PARTY ledger a customer as well (e.g. a supplier that is ' +
      'also sold to). No ledger is created; the customer takes the ledger id as its cusId, and ' +
      'the ledger keeps its group (cusAreaId is still required, for beats and area filters). ' +
      'Name, state, address, contact, GSTIN and PAN left out default from the ledger. 409 when ' +
      'the ledger is already a customer.',
  })
  @OptionalUuid()
  cusLinkLedId?: string;

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

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableStringStrict(200)
  cusAddr1?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableStringStrict(200)
  cusAddr2?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableStringStrict(200)
  cusAddr3?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  cusCity?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  cusDistrict?: string | null;

  @ApiProperty({ maxLength: 100, description: 'May be left out when cusLinkLedId is set' })
  @ValidateIf((o: SaveCustomerDto) => !o.cusLinkLedId || Boolean(o.cusStateName))
  @TrimmedString(100)
  @IsNotEmpty()
  cusStateName!: string;

  @ApiPropertyOptional({ maxLength: 60, nullable: true })
  @NullableStringStrict(60)
  cusCountry?: string | null;

  @ApiProperty({
    minLength: 2,
    maxLength: 2,
    description: 'May be left out when cusLinkLedId is set',
  })
  @ValidateIf((o: SaveCustomerDto) => !o.cusLinkLedId || Boolean(o.cusStateCode))
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

  @ApiPropertyOptional({ maxLength: 120, nullable: true, format: 'email' })
  @NullableStringStrict(120)
  @IsEmail()
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

  // F3: on these NOT NULL columns an explicit null means "cleared" and is stored as the
  // column default, 0 (the Qt blankAs(0) and React already send 0).
  @ApiPropertyOptional({
    type: Number,
    default: 0,
    minimum: 0,
    nullable: true,
    description: 'null = 0',
  })
  @NullableInteger(0)
  cusCreditBillLimit?: number | null;

  @ApiPropertyOptional({
    type: Number,
    default: 0,
    minimum: 0,
    nullable: true,
    description: 'null = 0',
  })
  @NullableNumber(0)
  cusCreditAmtLimit?: number | null;

  @ApiPropertyOptional({
    type: Number,
    default: 0,
    minimum: 0,
    nullable: true,
    description: 'null = 0',
  })
  @NullableInteger(0)
  cusCreditDays?: number | null;

  @ApiPropertyOptional({
    type: Number,
    default: 0,
    nullable: true,
    description: 'null = 0',
  })
  @NullableNumber()
  cusDebitBalance?: number | null;

  @ApiPropertyOptional({
    type: Number,
    default: 0,
    minimum: 0,
    maximum: 100,
    nullable: true,
    description: 'null = 0',
  })
  @NullableNumber(0)
  @Max(100)
  cusDiscPerc?: number | null;

  @ApiPropertyOptional({
    type: Number,
    default: 0,
    minimum: 0,
    nullable: true,
    description: 'null = 0',
  })
  @NullableInteger(0)
  cusDebitGraceDays?: number | null;

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

  @ApiPropertyOptional({
    type: Number,
    default: 0,
    minimum: 0,
    nullable: true,
    description: 'null = 0',
  })
  @NullableInteger(0)
  cusSortOrder?: number | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableStringStrict(200)
  cusRegionName?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableStringStrict(200)
  cusRegionAddr1?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableStringStrict(200)
  cusRegionAddr2?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableStringStrict(200)
  cusRegionAddr3?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  cusRegionCity?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
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

  @ApiPropertyOptional({
    maxLength: 15,
    nullable: true,
    pattern: CUSTOMER_GSTIN_PATTERN.source,
    description:
      'Upper-cased. Any GSTN shape (normal, TDS deductor, UIN, OIDAR, NRTP); a normal GSTIN must start with cusStateCode.',
  })
  @NullableUpperPattern(15, 'isGstin', CUSTOMER_GSTIN_PATTERN, 'a 15-character GSTIN')
  cusGstNo?: string | null;

  @ApiPropertyOptional({
    maxLength: 10,
    nullable: true,
    pattern: CUSTOMER_PAN_PATTERN.source,
    description: 'Upper-cased.',
  })
  @NullableUpperPattern(10, 'isPan', CUSTOMER_PAN_PATTERN, 'a 10-character PAN (AAAAA9999A)')
  cusPanNo?: string | null;

  @ApiPropertyOptional({
    maxLength: 30,
    nullable: true,
    enum: ['REGULAR', 'COMPOSITION', 'SEZ', 'OVERSEAS', 'UNREGISTERED'],
    description:
      'Party rules D2. Old spellings (Regular, unregistered, SEZ Unit …) are mapped to the code. Blank = UNREGISTERED when there is no GSTIN. REGULAR / COMPOSITION / SEZ need cusGstNo; UNREGISTERED / OVERSEAS refuse one; OVERSEAS needs cusStateCode 96.',
  })
  @NullableStringStrict(30)
  cusGstType?: string | null;

  @ApiPropertyOptional({
    maxLength: 15,
    nullable: true,
    pattern: CUSTOMER_GSTIN_PATTERN.source,
    description: 'Upper-cased.',
  })
  @NullableUpperPattern(15, 'isGstin', CUSTOMER_GSTIN_PATTERN, 'a 15-character GSTIN')
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

  @ApiPropertyOptional({
    nullable: true,
    format: 'date',
    deprecated: true,
    description: 'Ignored (party rules D3): last billed is read from the posted bills. Accepted for one release.',
  })
  @NullableDateString()
  cusBilledDate?: string | null;

  @ApiPropertyOptional({ default: 0, deprecated: true, description: 'Ignored (party rules D3), as cusBilledDate.' })
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

  // F6: accepted (so an old client that echoes them does not 400 on the whitelist) but
  // IGNORED. The created/modified stamps and the audit row always name the logged-in user.
  @ApiPropertyOptional({ maxLength: 100, nullable: true, deprecated: true, description: 'Ignored' })
  @NullableStringStrict(100)
  cusCreatedBy?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true, deprecated: true, description: 'Ignored' })
  @NullableStringStrict(100)
  cusModifiedBy?: string | null;
}
