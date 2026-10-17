import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsIn, IsIP, IsNotEmpty, IsOptional, Matches } from 'class-validator';
import {
  NullableStringStrict,
  NullableUuid,
  OptionalBoolean,
  OptionalInteger,
  OptionalUuid,
  RequiredUuid,
  SkipOnNullish,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';
import { GST_ENVIRONMENTS, GST_SERVICES } from '../config/gst-config.constants';
import {
  DateOnly,
  NullableDateOnly,
  NullableUpperEnum,
  UpperEnum,
  WriteOnlySecret,
} from './gst-dto.decorators';

/** `password` is NOT NULL in the table, so it can be replaced but never cleared. */
export const GST_CREDENTIAL_CLEARABLE_KEYS = ['clientId', 'clientSecret', 'appKey'] as const;

const SECRET_NOTE =
  'Write-only. Absent or "" keeps what is stored; a value is encrypted with GST_CRED_KEY. ' +
  'Never returned — /get answers with a has* flag.';

/**
 * POST /gst/company-credentials/create — the taxpayer's portal login for a
 * company (or a branch with its own registration) × service × environment.
 * Notes 79 R7 + §3. The GSTIN is NOT a field: it is the branch's, else the
 * company's, resolved as vw_gst_credential does.
 */
export class SaveGstCompanyCredentialDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Absent = create; present = update.' })
  @OptionalUuid()
  gccId?: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  gccCompanyId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'NULL = files under the company GSTIN; set = under that branch’s own GSTIN.',
  })
  @NullableUuid()
  gccBranchId?: string | null;

  @ApiProperty({ format: 'uuid', description: 'The provider this login signs in through.' })
  @RequiredUuid()
  gccGpvId!: string;

  @ApiPropertyOptional({
    enum: GST_SERVICES,
    nullable: true,
    description:
      'NULL = one login for every service (gateway GSPs); set = that service (direct NIC).',
  })
  @NullableUpperEnum(GST_SERVICES)
  gccService?: string | null;

  @ApiProperty({ enum: GST_ENVIRONMENTS })
  @UpperEnum(GST_ENVIRONMENTS)
  gccEnvironment!: string;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 9,
    default: 1,
    description:
      '1 = primary, 2+ = failover order. One live, active primary per company + branch + ' +
      'service + environment (409 GST_CREDENTIAL_PRIMARY_EXISTS); each priority once per ' +
      'that key among live rows (409 GST_CREDENTIAL_PRIORITY_TAKEN).',
  })
  @OptionalInteger(1, 9)
  gccPriority?: number;

  @ApiProperty({
    description: 'The portal API user. Not a secret: support must see which login fails.',
  })
  @TrimmedString(200)
  @IsNotEmpty()
  gccLoginId!: string;

  @ApiPropertyOptional({
    writeOnly: true,
    description: `${SECRET_NOTE} Required on create; can be replaced, never cleared. Stamps gccPasswordChangedOn.`,
  })
  @WriteOnlySecret()
  password?: string;

  @ApiPropertyOptional({
    writeOnly: true,
    description: `${SECRET_NOTE} Set with clientSecret, or neither.`,
  })
  @WriteOnlySecret()
  clientId?: string;

  @ApiPropertyOptional({
    writeOnly: true,
    description: `${SECRET_NOTE} Set with clientId, or neither.`,
  })
  @WriteOnlySecret()
  clientSecret?: string;

  @ApiPropertyOptional({
    writeOnly: true,
    description: `${SECRET_NOTE} NIC's AppKey (32 bytes, base64).`,
  })
  @WriteOnlySecret()
  appKey?: string;

  @ApiPropertyOptional({
    enum: GST_CREDENTIAL_CLEARABLE_KEYS,
    isArray: true,
    example: ['clientId', 'clientSecret'],
    description: 'Secrets to set to NULL (not password). A key may not be both given and cleared.',
  })
  @IsOptional()
  @IsArray()
  @IsIn(GST_CREDENTIAL_CLEARABLE_KEYS, {
    each: true,
    message: `each of clear must be one of: ${GST_CREDENTIAL_CLEARABLE_KEYS.join(', ')}`,
  })
  clear?: Array<(typeof GST_CREDENTIAL_CLEARABLE_KEYS)[number]>;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 100,
    example: 'nic-einv-sandbox',
    description:
      'The IRP / GSP public key the auth body is RSA-encrypted with (NIC direct): the file ' +
      '<ref>.pem under GST_PUBLIC_KEY_DIR.',
  })
  @NullableStringStrict(100)
  @SkipOnNullish()
  @Matches(/^[A-Za-z0-9._-]+$/, { message: 'gccPublicKeyRef may hold only letters, digits, . _ -' })
  gccPublicKeyRef?: string | null;

  @ApiPropertyOptional({
    type: [String],
    example: ['203.0.113.10'],
    description:
      'The static IPs registered with the portal for this GSTIN. null / absent on create = [].',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === null
      ? []
      : Array.isArray(value)
        ? (value as unknown[]).map((ip) => (typeof ip === 'string' ? ip.trim() : ip))
        : value,
  )
  @IsArray()
  @IsIP(undefined, {
    each: true,
    message: 'each of gccWhitelistedIps must be an IPv4 or IPv6 address',
  })
  gccWhitelistedIps?: string[];

  @ApiProperty({ example: '2026-04-01' })
  @DateOnly()
  gccValidFrom!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: '2027-03-31' })
  @NullableDateOnly()
  gccValidUpto?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 500 })
  @NullableStringStrict(500)
  gccRemarks?: string | null;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  gccIsActive?: boolean;
}
