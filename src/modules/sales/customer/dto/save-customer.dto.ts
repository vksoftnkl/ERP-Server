import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  ValidateBy,
  ValidateIf,
} from 'class-validator';
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
  SkipOnNullish,
  TrimmedString,
  UpperString,
} from 'src/common/dto/dtoDecorators';

/**
 * Every GSTN registration shape a customer can hold (U1). All are 15 characters, upper
 * case. Written from GSTN's published structure of each number (GSTIN / UIN layouts in
 * the GST registration rules and GSTN FAQs), from knowledge, not copied from a fetched
 * file; there is no checksum test here (Qt adds one for NORMAL):
 *  - NORMAL: 2-digit state + PAN (AAAAA9999A) + entity no. + 'Z' + check
 *    (regular, composition, SEZ, casual, ISD, e-commerce TCS collector). Same as the
 *    Qt TaxValidator today.
 *  - TDS_DEDUCTOR: 2-digit state + TAN (AAAA99999A) + entity no. + 'D' + check
 *    (government departments deducting GST TDS, section 51).
 *  - UIN: 2-digit state + 2-digit country code + 3-letter body code + 5 digits + 'UN'
 *    or 'ON' + check (embassies, UN bodies, notified persons).
 *  - OIDAR: '99' + 2-digit country code + 3 letters + 5 digits + 'OS' + check
 *    (online services from abroad; state 99 is "Centre Jurisdiction").
 *  - NRTP: 2-digit state + 2-digit country code + 3 letters + 5 digits + 'NR' + check
 *    (non-resident taxable person).
 * Only NORMAL has its state checked against cusStateCode (CUSTOMER_GSTIN_STATE_MISMATCH).
 */
export const CUSTOMER_GSTIN_PATTERNS = {
  NORMAL: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
  TDS_DEDUCTOR: /^[0-9]{2}[A-Z]{4}[0-9]{5}[A-Z][1-9A-Z]D[0-9A-Z]$/,
  UIN: /^[0-9]{4}[A-Z]{3}[0-9]{5}[UO]N[0-9A-Z]$/,
  OIDAR: /^99[0-9]{2}[A-Z]{3}[0-9]{5}OS[0-9A-Z]$/,
  NRTP: /^[0-9]{4}[A-Z]{3}[0-9]{5}NR[0-9A-Z]$/,
} as const;
export type CustomerGstinKind = keyof typeof CUSTOMER_GSTIN_PATTERNS;
/** Which shape a GSTIN has, or null when it has none of them. */
export function gstinKindOf(gstin: string): CustomerGstinKind | null {
  for (const kind of Object.keys(CUSTOMER_GSTIN_PATTERNS) as CustomerGstinKind[]) {
    if (CUSTOMER_GSTIN_PATTERNS[kind].test(gstin)) {
      return kind;
    }
  }
  return null;
}
/** Any accepted shape, as one pattern (Swagger, and for the Qt validator to match). */
export const CUSTOMER_GSTIN_PATTERN = new RegExp(
  `^(?:${Object.values(CUSTOMER_GSTIN_PATTERNS)
    .map((pattern) => pattern.source.slice(1, -1))
    .join('|')})$`,
);
/** Income-tax PAN: 5 letters, 4 digits, 1 letter. */
export const CUSTOMER_PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

const toNullableUpperStrict = (value: unknown): unknown => {
  if (value === undefined || value === null || typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim().toUpperCase();
  return trimmed ? trimmed : null;
};

/**
 * Trimmed and upper-cased; blank is null (= cleared) and is not checked. A sent value
 * must match `pattern`; the house pipe codes the refusal VALIDATION_ + the constraint
 * name in upper snake case (isGstin -> VALIDATION_IS_GSTIN).
 */
const NullableUpperPattern = (
  maxLength: number,
  constraint: string,
  pattern: RegExp,
  what: string,
) =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }) => toNullableUpperStrict(value)),
    SkipOnNullish(),
    IsString(),
    MaxLength(maxLength),
    ValidateBy({
      name: constraint,
      validator: {
        validate: (value: unknown) => typeof value === 'string' && pattern.test(value),
        defaultMessage: (args) => `${args?.property ?? 'value'} must be ${what}`,
      },
    }),
  );

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

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
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

  // F6: accepted (so an old client that echoes them does not 400 on the whitelist) but
  // IGNORED. The created/modified stamps and the audit row always name the logged-in user.
  @ApiPropertyOptional({ maxLength: 100, nullable: true, deprecated: true, description: 'Ignored' })
  @NullableStringStrict(100)
  cusCreatedBy?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true, deprecated: true, description: 'Ignored' })
  @NullableStringStrict(100)
  cusModifiedBy?: string | null;
}
