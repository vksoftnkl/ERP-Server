import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { NullableStringStrict, OptionalBoolean, RequiredUuid, TrimmedString } from 'src/common/dto/dtoDecorators';

/**
 * WhatsApp plan §5.3 — request bodies and queries of /api/v1/whatsapp/*.
 * Every key a client sends is declared (forbidNonWhitelisted).
 */

const ACC_YEAR = /^\d{4}-\d{4}$/;
/** Scope cut 17/11: the Sales Order confirmation only (bills and receipts later). */
export const WA_DOC_TYPE_VALUES = ['SALES_ORDER'] as const;

export class WaCompanyDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;
}

export class WaActivateDto extends WaCompanyDto {
  @ApiProperty({ description: "VK's one-time activation code (case, spaces and dashes ignored)", example: 'ABCD-EFGH-JKMN-PQRS' })
  @TrimmedString(40)
  @IsNotEmpty()
  activationCode!: string;

  @ApiPropertyOptional({
    description:
      'Use this code although the company is already activated here (VK re-key / recovery). Without it a healthy ' +
      'activation answers 409 WA_ALREADY_ACTIVATED and the code is not spent.',
  })
  @OptionalBoolean()
  replace?: boolean;
}

export class WaDisconnectDto extends WaCompanyDto {
  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableStringStrict(200)
  reason?: string | null;
}

export class WaTestDto extends WaCompanyDto {
  @ApiProperty({ example: '919865322154', description: 'A mobile number (10 digits or with 91)' })
  @TrimmedString(20)
  @IsNotEmpty()
  phone!: string;
}

export class WaOnPostTickDto {
  @ApiProperty({ example: 3 })
  @IsInt()
  vchrTypeId!: number;

  @ApiProperty()
  @IsBoolean()
  on!: boolean;
}

/**
 * Settings: every value is judged by the service (WA_SETTING_INVALID with
 * field = the key), so the declared type is loose on purpose.
 */
export class WaSettingsSaveDto extends WaCompanyDto {
  @ApiPropertyOptional({ type: String, enum: ['en', 'ta'] })
  @IsOptional()
  defaultLanguage?: unknown;

  @ApiPropertyOptional({ type: String, example: '0.115', description: 'Decimal string or number, ≥ 0, ≤ 4 decimals' })
  @IsOptional()
  ratePerMessage?: unknown;

  @ApiPropertyOptional({ type: String, example: '18', description: '0–100, ≤ 2 decimals' })
  @IsOptional()
  rateGstPercent?: unknown;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  fallbackClickToChat?: unknown;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 10 })
  @IsOptional()
  logRetentionYears?: unknown;

  @ApiPropertyOptional({
    type: [WaOnPostTickDto],
    description: "WhatsApp on Post ticks, saved as this company's whatsapp.on_post_types (Sales Order (4) only in this build)",
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => WaOnPostTickDto)
  onPostTypes?: WaOnPostTickDto[];
}

export class WaSendDto extends WaCompanyDto {
  @ApiProperty({ format: 'uuid', description: "The sender's branch" })
  @RequiredUuid()
  branchId!: string;

  @ApiProperty({ enum: WA_DOC_TYPE_VALUES })
  @IsIn(WA_DOC_TYPE_VALUES)
  docType!: (typeof WA_DOC_TYPE_VALUES)[number];

  @ApiProperty({ format: 'uuid', description: 'so_id' })
  @RequiredUuid()
  docId!: string;

  @ApiProperty({ example: '2026-2027' })
  @IsString()
  @Matches(ACC_YEAR)
  docAccYear!: string;

  @ApiPropertyOptional({ description: 'A number typed in the send popup: goes first, never copied to the master' })
  @NullableStringStrict(20)
  phone?: string | null;

  @ApiPropertyOptional({ enum: ['en', 'ta'], nullable: true })
  @IsOptional()
  @IsIn(['en', 'ta'])
  lang?: string | null;
}

export class WaRetryDto extends WaCompanyDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  wmlId!: string;

  @ApiProperty({ example: '2026-2027' })
  @IsString()
  @Matches(ACC_YEAR)
  accYear!: string;

  @ApiPropertyOptional({ description: 'Send a DELIVERED / READ message again (answer to 409 WA_ALREADY_DELIVERED)' })
  @OptionalBoolean()
  confirmResend?: boolean;
}
