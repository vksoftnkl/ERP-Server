import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsNotEmpty, IsOptional } from 'class-validator';
import {
  NullableStringStrict,
  OptionalBoolean,
  OptionalUuid,
  RequiredUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';
import { GST_ENVIRONMENTS, GST_SERVICES } from '../config/gst-config.constants';
import {
  NullableDateOnly,
  NullableUpperEnum,
  UpperEnum,
  WriteOnlySecret,
} from './gst-dto.decorators';

export const GST_ACCOUNT_SECRET_KEYS = ['clientId', 'clientSecret', 'apiKey'] as const;

const SECRET_NOTE =
  'Write-only. Absent or "" keeps what is stored; a value is encrypted with GST_CRED_KEY. ' +
  'Never returned — /get answers with a has* flag.';

/**
 * POST /gst/provider-accounts/create — the GSP's own account, provider ×
 * environment (× service, rarely). Notes 79 R6 + §3. For Chartered, the aspid
 * goes in clientId and the ASP password in clientSecret (the {aspId} /
 * {aspPassword} header placeholders read those two).
 */
export class SaveGstProviderAccountDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Absent = create; present = update.' })
  @OptionalUuid()
  gpaId?: string;

  @ApiProperty({ format: 'uuid', description: 'The provider. Fixed once created.' })
  @RequiredUuid()
  gpaGpvId!: string;

  @ApiProperty({
    enum: GST_ENVIRONMENTS,
    description: 'One live row per (provider, environment, service) — 409 GST_ACCOUNT_DUPLICATE.',
  })
  @UpperEnum(GST_ENVIRONMENTS)
  gpaEnvironment!: string;

  @ApiPropertyOptional({
    enum: GST_SERVICES,
    nullable: true,
    description: 'NULL = every service of the provider (the norm); set = that service only.',
  })
  @NullableUpperEnum(GST_SERVICES)
  gpaService?: string | null;

  @ApiProperty({ maxLength: 100, description: 'Your account number with the GSP. Not a secret.' })
  @TrimmedString(100)
  @IsNotEmpty()
  gpaAccountRef!: string;

  @ApiPropertyOptional({ description: SECRET_NOTE, writeOnly: true })
  @WriteOnlySecret()
  clientId?: string;

  @ApiPropertyOptional({ description: SECRET_NOTE, writeOnly: true })
  @WriteOnlySecret()
  clientSecret?: string;

  @ApiPropertyOptional({ description: SECRET_NOTE, writeOnly: true })
  @WriteOnlySecret(2000)
  apiKey?: string;

  @ApiPropertyOptional({
    enum: GST_ACCOUNT_SECRET_KEYS,
    isArray: true,
    example: ['clientSecret'],
    description: 'Secrets to set to NULL. A key may not be both given and cleared.',
  })
  @IsOptional()
  @IsArray()
  @IsIn(GST_ACCOUNT_SECRET_KEYS, {
    each: true,
    message: `each of clear must be one of: ${GST_ACCOUNT_SECRET_KEYS.join(', ')}`,
  })
  clear?: Array<(typeof GST_ACCOUNT_SECRET_KEYS)[number]>;

  @ApiPropertyOptional({ type: String, nullable: true, example: '2026-04-01' })
  @NullableDateOnly()
  gpaValidFrom?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '2027-03-31' })
  @NullableDateOnly()
  gpaValidUpto?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 500 })
  @NullableStringStrict(500)
  gpaRemarks?: string | null;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  gpaIsActive?: boolean;
}
