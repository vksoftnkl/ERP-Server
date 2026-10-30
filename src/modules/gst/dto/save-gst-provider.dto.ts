import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  ValidateIf,
} from 'class-validator';
import {
  NullableEmail,
  NullableInteger,
  NullableStringStrict,
  OptionalBoolean,
  OptionalInteger,
  OptionalTrimmedString,
  OptionalUuid,
  RequiredUuid,
  SkipOnNullish,
  TrimmedString,
  UpperMaxString,
} from 'src/common/dto/dtoDecorators';
import {
  GST_ACTIONS,
  GST_AUTH_SCHEMES,
  GST_ENVIRONMENTS,
  GST_FIELD_DATA_TYPES,
  GST_FIELD_DIRECTIONS,
  GST_FIELD_TRANSFORMS,
  GST_HTTP_METHODS,
  GST_JSON_PATH_PATTERN,
  GST_OUR_ERROR_CODES,
  GST_PAYLOAD_ENCRYPTIONS,
  GST_PROVIDER_CODE_PATTERN,
  GST_RECOVERY_ACTIONS,
  GST_SERVICES,
  GST_SEVERITIES,
  GST_TREAT_AS,
} from '../config/gst-config.constants';
import { NullableUpperEnum, OptionalUpperEnum, UpperEnum } from './gst-dto.decorators';

/*
 * The provider-side config (notes 79 R1–R5). Every save is an upsert by id:
 * no id creates, an id updates. On an update a field left out keeps what is
 * stored, and null clears a nullable one.
 */

const JSON_PATH_MESSAGE = {
  message: '$property must be a JSONPath from the root, starting with $',
};
const JSON_PATH_EACH = { each: true, message: 'each of $property must start with $' };
const URL_MESSAGE = { message: '$property must be http(s)://host, no trailing slash' };
const URL_PATTERN = /^https?:\/\/\S+$/;

/** A base URL with its trailing slashes dropped, so "https://host/" is accepted as "https://host". */
const toBaseUrl = (value: unknown): unknown =>
  typeof value === 'string' ? value.trim().replace(/\/+$/, '') : value;

/** POST /gst/providers/create — the header of gst_provider. */
export class SaveGstProviderDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Absent = create; present = update.' })
  @OptionalUuid()
  gpvId?: string;

  @ApiProperty({
    maxLength: 20,
    example: 'NIC',
    description:
      "Short stable handle: 'NIC', 'CHARTERED'. Upper-cased; A–Z, 0–9, _. Unique across ALL " +
      'providers, deleted ones too (409 GST_PROVIDER_CODE_DUPLICATE), and never renamed — an ' +
      'update with another code is a 409 GST_PROVIDER_CODE_FIXED. Retire the row instead.',
  })
  @UpperMaxString(20)
  @Matches(GST_PROVIDER_CODE_PATTERN, {
    message: 'gpvCode must start with a letter and hold only A-Z, 0-9 and _',
  })
  gpvCode!: string;

  @ApiProperty({ maxLength: 150 })
  @TrimmedString(150)
  @IsNotEmpty()
  gpvName!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Where a human goes. Not used by code.',
  })
  @NullableStringStrict(500)
  gpvPortalUrl?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 120 })
  @NullableEmail(120)
  gpvSupportEmail?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 20 })
  @NullableStringStrict(20)
  gpvSupportPhone?: string | null;

  @ApiPropertyOptional({ minimum: 1000, maximum: 600000, default: 30000 })
  @OptionalInteger(1000, 600000)
  gpvTimeoutMs?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 10, default: 2 })
  @OptionalInteger(0, 10)
  gpvMaxRetries?: number;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: 1,
    description: 'NULL = unmetered.',
  })
  @NullableInteger(1)
  @Max(32767)
  gpvRateLimitPerMin?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 500 })
  @NullableStringStrict(500)
  gpvRemarks?: string | null;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  gpvIsActive?: boolean;
}

/** POST /gst/provider-services/create — one (provider, service, environment). */
export class SaveGstProviderServiceDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Absent = create; present = update.' })
  @OptionalUuid()
  gpsId?: string;

  @ApiProperty({ format: 'uuid', description: 'The provider. Fixed once created.' })
  @RequiredUuid()
  gpsGpvId!: string;

  @ApiProperty({ enum: GST_SERVICES })
  @UpperEnum(GST_SERVICES)
  gpsService!: string;

  @ApiProperty({
    enum: GST_ENVIRONMENTS,
    description:
      '(service, environment) is unique per provider among live rows — 409 GST_SERVICE_DUPLICATE.',
  })
  @UpperEnum(GST_ENVIRONMENTS)
  gpsEnvironment!: string;

  @ApiProperty({
    example: 'https://einv-apisandbox.nic.in',
    description: 'Scheme + host; a trailing / is dropped.',
  })
  @Transform(({ value }) => toBaseUrl(value))
  @IsString()
  @Matches(URL_PATTERN, URL_MESSAGE)
  gpsBaseUrl!: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Other hosts of the SAME service, tried in order. null / absent on create = [].',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === null
      ? []
      : Array.isArray(value)
        ? (value as unknown[]).map((url) => toBaseUrl(url))
        : value,
  )
  @IsArray()
  @IsString({ each: true })
  @Matches(URL_PATTERN, { ...URL_MESSAGE, each: true })
  gpsFallbackUrls?: string[];

  @ApiProperty({ enum: GST_AUTH_SCHEMES })
  @UpperEnum(GST_AUTH_SCHEMES)
  gpsAuthScheme!: string;

  @ApiPropertyOptional({ minimum: 1, default: 360 })
  @OptionalInteger(1, 32767)
  gpsTokenTtlMinutes?: number;

  @ApiPropertyOptional({
    minimum: 0,
    default: 15,
    description: 'Must be below gpsTokenTtlMinutes.',
  })
  @OptionalInteger(0, 32767)
  gpsRefreshMarginMinutes?: number;

  @ApiPropertyOptional({ enum: GST_PAYLOAD_ENCRYPTIONS, default: 'NONE' })
  @OptionalUpperEnum(GST_PAYLOAD_ENCRYPTIONS)
  gpsPayloadEncryption?: string;

  @ApiPropertyOptional({ type: Number, nullable: true, description: 'NULL = the provider’s.' })
  @NullableInteger(1000)
  @Max(600000)
  gpsTimeoutMs?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, description: 'NULL = the provider’s.' })
  @NullableInteger(0)
  @Max(10)
  gpsMaxRetries?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 500 })
  @NullableStringStrict(500)
  gpsRemarks?: string | null;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  gpsIsActive?: boolean;
}

/** POST /gst/provider-endpoints/create — one call (action) of a service. */
export class SaveGstProviderEndpointDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Absent = create; present = update.' })
  @OptionalUuid()
  gpeId?: string;

  @ApiProperty({ format: 'uuid', description: 'The service. Fixed once created.' })
  @RequiredUuid()
  gpeGpsId!: string;

  @ApiProperty({
    enum: GST_ACTIONS,
    description: 'One live row per (service, action) — 409 GST_ENDPOINT_DUPLICATE.',
  })
  @UpperEnum(GST_ACTIONS)
  gpeAction!: string;

  @ApiPropertyOptional({ enum: GST_HTTP_METHODS, default: 'POST' })
  @OptionalUpperEnum(GST_HTTP_METHODS)
  gpeHttpMethod?: string;

  @ApiProperty({
    example: '/eivital/v1.04/auth',
    description:
      'Appended to the base URL; starts with /. May carry {gstin}, {irn}, {ewbNo}, {period}.',
  })
  @TrimmedString()
  @Matches(/^\//, { message: 'gpePathTemplate must start with /' })
  gpePathTemplate!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: '?QrCodeSize=250' })
  @NullableStringStrict()
  gpeQueryTemplate?: string | null;

  @ApiPropertyOptional({ maxLength: 60, default: 'application/json' })
  @OptionalTrimmedString(60)
  gpeContentType?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'string' },
    nullable: true,
    example: { Gstin: '{gstin}', client_id: '{clientId}', client_secret: '{clientSecret}' },
    description:
      'Header name → value template. Placeholders: {gstin} {loginId} {password} {clientId} ' +
      '{clientSecret} {aspId} {aspPassword} {apiKey} {appKey} {authToken}. Values must be strings.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsObject()
  gpeHeaders?: Record<string, string> | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 30, example: 'Data' })
  @NullableStringStrict(30)
  gpeRequestWrapper?: string | null;

  @ApiPropertyOptional({
    type: [String],
    nullable: true,
    example: ['$.Password', '$.AppKey'],
    description: 'JSONPaths blanked before the exchange is logged.',
  })
  @IsOptional()
  @SkipOnNullish()
  @IsArray()
  @IsString({ each: true })
  @Matches(GST_JSON_PATH_PATTERN, JSON_PATH_EACH)
  gpeRedactPaths?: string[] | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '$.Data' })
  @NullableStringStrict()
  @SkipOnNullish()
  @Matches(GST_JSON_PATH_PATTERN, JSON_PATH_MESSAGE)
  gpeResponseRootPath?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '$.Status',
    description: 'Set together with gpeSuccessValue, or neither.',
  })
  @NullableStringStrict()
  @SkipOnNullish()
  @Matches(GST_JSON_PATH_PATTERN, JSON_PATH_MESSAGE)
  gpeSuccessPath?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 20, example: '1' })
  @NullableStringStrict(20)
  gpeSuccessValue?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '$.ErrorDetails[0].ErrorCode' })
  @NullableStringStrict()
  @SkipOnNullish()
  @Matches(GST_JSON_PATH_PATTERN, JSON_PATH_MESSAGE)
  gpeErrorCodePath?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '$.ErrorDetails[0].ErrorMessage' })
  @NullableStringStrict()
  @SkipOnNullish()
  @Matches(GST_JSON_PATH_PATTERN, JSON_PATH_MESSAGE)
  gpeErrorMessagePath?: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true, description: 'NULL = the service’s.' })
  @NullableInteger(1000)
  @Max(600000)
  gpeTimeoutMs?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, description: 'NULL = the service’s.' })
  @NullableInteger(0)
  @Max(10)
  gpeMaxRetries?: number | null;

  @ApiPropertyOptional({
    default: false,
    description: 'Safe to resend after a timeout. Never GENERATE_IRN.',
  })
  @OptionalBoolean()
  gpeIsIdempotent?: boolean;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 500 })
  @NullableStringStrict(500)
  gpeRemarks?: string | null;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  gpeIsActive?: boolean;
}

/** POST /gst/provider-field-maps/create — one field of an endpoint's request or reply. */
export class SaveGstProviderFieldMapDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Absent = create; present = update.' })
  @OptionalUuid()
  gfmId?: string;

  @ApiProperty({ format: 'uuid', description: 'The endpoint. Fixed once created.' })
  @RequiredUuid()
  gfmGpeId!: string;

  @ApiProperty({ enum: GST_FIELD_DIRECTIONS })
  @UpperEnum(GST_FIELD_DIRECTIONS)
  gfmDirection!: string;

  @ApiProperty({
    maxLength: 60,
    example: 'auth_token',
    description:
      'Our canonical name. One live row per (endpoint, direction, field) — 409 GST_FIELD_MAP_DUPLICATE.',
  })
  @TrimmedString(60)
  @IsNotEmpty()
  gfmOurField!: string;

  @ApiProperty({ example: '$.AuthToken' })
  @TrimmedString()
  @Matches(GST_JSON_PATH_PATTERN, JSON_PATH_MESSAGE)
  gfmTheirPath!: string;

  @ApiPropertyOptional({ enum: GST_FIELD_DATA_TYPES, default: 'TEXT' })
  @OptionalUpperEnum(GST_FIELD_DATA_TYPES)
  gfmDataType?: string;

  @ApiPropertyOptional({
    enum: GST_FIELD_TRANSFORMS,
    default: 'NONE',
    description: 'DATETIME_MASK needs gfmFormatMask.',
  })
  @OptionalUpperEnum(GST_FIELD_TRANSFORMS)
  gfmTransform?: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 40,
    example: 'dd/MM/yyyy hh:mm:ss tt',
  })
  @NullableStringStrict(40)
  gfmFormatMask?: string | null;

  @ApiPropertyOptional({
    default: false,
    description: 'A required field may not also carry a default.',
  })
  @OptionalBoolean()
  gfmIsRequired?: boolean;

  @ApiPropertyOptional({ type: String, nullable: true })
  @NullableStringStrict()
  gfmDefaultValue?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 64, example: 'gde_irn' })
  @NullableStringStrict(64)
  @SkipOnNullish()
  @Matches(/^[a-z_][a-z0-9_]*$/, { message: 'gfmTargetColumn must be a column name: a-z, 0-9, _' })
  gfmTargetColumn?: string | null;

  @ApiPropertyOptional({ default: 0 })
  @OptionalInteger(-32768, 32767)
  gfmSortOrder?: number;
}

/** POST /gst/provider-error-maps/create — what one of the provider's codes means to us. */
export class SaveGstProviderErrorMapDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Absent = create; present = update.' })
  @OptionalUuid()
  gemId?: string;

  @ApiProperty({ format: 'uuid', description: 'The provider. Fixed once created.' })
  @RequiredUuid()
  gemGpvId!: string;

  @ApiPropertyOptional({
    enum: GST_SERVICES,
    nullable: true,
    description: 'NULL = every service of the provider.',
  })
  @NullableUpperEnum(GST_SERVICES)
  gemService?: string | null;

  @ApiProperty({
    maxLength: 50,
    example: '2150',
    description: 'One live row per (provider, service, code) — 409 GST_ERROR_MAP_DUPLICATE.',
  })
  @TrimmedString(50)
  @IsNotEmpty()
  gemTheirCode!: string;

  @ApiProperty({ enum: GST_OUR_ERROR_CODES })
  @UpperEnum(GST_OUR_ERROR_CODES)
  gemOurCode!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 500,
    description: 'Shown to the counter operator.',
  })
  @NullableStringStrict(500)
  gemMessage?: string | null;

  @ApiPropertyOptional({
    enum: GST_TREAT_AS,
    default: 'ERROR',
    description: 'SUCCESS needs gemExtractPath and gemCanonicalField.',
  })
  @OptionalUpperEnum(GST_TREAT_AS)
  gemTreatAs?: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: '$.ErrorDetails[0].InfoDtls.Irn' })
  @NullableStringStrict()
  @SkipOnNullish()
  @Matches(GST_JSON_PATH_PATTERN, JSON_PATH_MESSAGE)
  gemExtractPath?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 60, example: 'irn' })
  @NullableStringStrict(60)
  gemCanonicalField?: string | null;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  gemIsRetryable?: boolean;

  @ApiPropertyOptional({ type: Number, nullable: true, minimum: 0 })
  @NullableInteger(0)
  gemRetryAfterSeconds?: number | null;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  gemShouldReauth?: boolean;

  @ApiPropertyOptional({ enum: GST_RECOVERY_ACTIONS, default: 'NONE' })
  @OptionalUpperEnum(GST_RECOVERY_ACTIONS)
  gemRecoveryAction?: string;

  @ApiPropertyOptional({ enum: GST_SEVERITIES, default: 'ERROR' })
  @OptionalUpperEnum(GST_SEVERITIES)
  gemSeverity?: string;
}
