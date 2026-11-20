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
  Matches,
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

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'The employee this user is. Must be a live employee of the user’s company (or of none), and ' +
      'not linked to another active user (409).',
  })
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
      'Plain-text password, at least 4 characters (spaces at either end not counted; ' +
      '400 USER_PASSWORD_TOO_SHORT). Required on create; optional on update (omit to keep ' +
      'the existing one). On an update it is an administrator reset (review step 6, U8): the ' +
      'user must change it at the next login unless usrMustChangePassword: false is sent.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  usrPassword?: string;

  // Notes 95 — the till approver's PIN. Hashed like the password into usr_pin_hash and never
  // returned (GET answers usrPinSet). It is checked only inside the till approval service;
  // there is no public verify route to brute-force.
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '4321',
    description:
      'Till PIN, 4 to 6 digits. "" (or null) clears it; omit the key to leave the stored PIN alone.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(\d{4,6})?$/, { message: 'usrPin must be 4 to 6 digits, or "" to clear it' })
  usrPin?: string | null;

  @ApiPropertyOptional()
  @OptionalBoolean()
  usrMustChangePassword?: boolean;

  @ApiPropertyOptional({
    enum: UserType,
    enumName: 'UserType',
    nullable: true,
    description:
      'User Role. A label only: it grants nothing by itself (menus come from user_menus, till ' +
      'approvals from till_approval_authority).',
  })
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

  @ApiPropertyOptional({
    description:
      'Screen label "Allow rate / discount change" (review step 6). Off: on a Sale Bill this ' +
      'user may not change a line rate from the one the item gives, nor give any discount. ' +
      'On: may, up to usrMaxDiscPerc.',
  })
  @OptionalBoolean()
  usrEditRate?: boolean;

  // Review step 6 (U6, D6-D9): the user's highest discount % on a Sale Bill, for each line and
  // for the bill-level discount. Judged by the service (USER_MAX_DISC_INVALID), not here, so
  // a string, a number or null all reach it.
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '12.50',
    description:
      'Max discount % on a Sale Bill (each line, and the bill discount): 0 to 100, at most 2 ' +
      'decimals kept. null or "" = no limit. Omit the key to keep the stored value. ' +
      'A string or a number. 400 USER_MAX_DISC_INVALID otherwise.',
  })
  @IsOptional()
  usrMaxDiscPerc?: string | number | null;

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

/**
 * POST /user-administration/reset-password (review step 6, U8): an administrator sets another
 * user's password, typed or generated, and the user must change it at the next login.
 */
export class ResetUserPasswordDto {
  @ApiProperty({ format: 'uuid', description: 'The user whose password is reset' })
  @IsUUID('all')
  usrId!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'The password the administrator typed: at least 4 characters, spaces at either end not ' +
      'counted (400 USER_PASSWORD_TOO_SHORT). Leave it out (or null / "") with generate: true.',
  })
  @IsOptional()
  @IsString()
  newPassword?: string | null;

  @ApiPropertyOptional({
    description:
      'true = the server makes a random 8-character password and answers it ONCE, in ' +
      'generatedPassword. Sent together with a newPassword: 400 USER_RESET_PASSWORD_CHOICE.',
  })
  @OptionalBoolean()
  generate?: boolean;
}
