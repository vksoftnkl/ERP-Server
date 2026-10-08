import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  NullableEmail,
  NullableString,
  NullableUuid,
  OptionalBoolean,
  OptionalInteger,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';
import { UserType } from '../types/user-administration.enum';

export class SaveUserMenuDto {
  @ApiProperty({ description: 'Menu ID (integer PK from menu_master)' })
  @IsInt()
  @Min(1)
  umMenuId!: number;

  @ApiPropertyOptional()
  @OptionalBoolean()
  umCanView?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  umCanCreate?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  umCanEdit?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  umCanDelete?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  umCanPrint?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  umCanExport?: boolean;

  // ── the five transaction rights ─────────────────────────────────────────
  //
  // A posting screen asks five questions a master screen does not, and until
  // these reached the DTO there was no way to grant them: the columns existed
  // (migration 20260921220000) and every one of the 1,111 rows was false, so
  // /bills/get answered `rights` all-false and the screen greyed every verb.
  //
  // A SAVE IS A FULL REPLACE. Omitting one of these is not "leave it alone",
  // it is "revoke it" — the client sends all eleven flags or it takes rights
  // away by silence. That is the same contract the six above already have.
  @ApiPropertyOptional({
    description: 'May put the document into the books (/post). Transaction screens only.',
  })
  @OptionalBoolean()
  umCanPost?: boolean;

  @ApiPropertyOptional({
    description: 'May take a POSTED document back out by reversal (/cancel).',
  })
  @OptionalBoolean()
  umCanCancel?: boolean;

  @ApiPropertyOptional({
    description: 'May restate a POSTED document in place (/amend) — unwind, re-apply, re-post.',
  })
  @OptionalBoolean()
  umCanAmend?: boolean;

  @ApiPropertyOptional({
    description:
      'May pass a WARN-level guard: discount cap, credit limit, back-date, rate below minimum. ' +
      'The server re-checks this flag as well as the overrides[] the request names.',
  })
  @OptionalBoolean()
  umCanOverride?: boolean;

  @ApiPropertyOptional({
    description:
      'May change how a POSTED bill was paid (/bills/retender). Separate from umCanAmend: the ' +
      'sale is not edited, only the tender — but it moves money between ledgers. Sales Entry only.',
  })
  @OptionalBoolean()
  umCanRetender?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  umVisibility?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  umIsFavourite?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  umIsPinned?: boolean;

  @ApiPropertyOptional({ minimum: 0 })
  @OptionalInteger(0)
  umSortOrder?: number;
}

export class SaveUserAdministrationDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing user',
  })
  @IsOptional()
  @IsUUID('all')
  usrId?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  usrCompanyId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  usrBranchId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  usrEmployeeId?: string | null;

  @ApiProperty({ maxLength: 50 })
  @TrimmedString(50)
  @IsNotEmpty()
  usrLoginName!: string;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  usrDisplayName?: string | null;

  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  @NullableString(150)
  usrFullName?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  usrMobileNo?: string | null;

  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  @NullableEmail(150)
  usrEmail?: string | null;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @NullableString(500)
  usrAvatarUrl?: string | null;

  @ApiPropertyOptional({ maxLength: 60, default: 'UTC' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  usrTimezone?: string;

  @ApiPropertyOptional({ maxLength: 10, default: 'en' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  usrLanguage?: string;

  @ApiPropertyOptional({
    description:
      'Plain-text password. Required on create; optional on update (omit to keep existing).',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  usrPassword?: string;

  @ApiPropertyOptional()
  @OptionalBoolean()
  usrMustChangePassword?: boolean;

  @ApiPropertyOptional({ enum: UserType, enumName: 'UserType', nullable: true })
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === undefined ? undefined : value === null ? null : (value as unknown),
  )
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsEnum(UserType)
  usrType?: UserType | null;

  @ApiPropertyOptional()
  @OptionalBoolean()
  usrEditDate?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  usrEditEntry?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  usrEditRate?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  usrDesktopLogin?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  usrWebLogin?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  usrMobileLogin?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  usrIsActive?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  usrNotes?: string | null;

  @ApiPropertyOptional({
    type: SaveUserMenuDto,
    isArray: true,
    description:
      'Full replacement set of menu permissions. Existing menus not in this list are soft-deleted.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveUserMenuDto)
  menus?: SaveUserMenuDto[];
}
