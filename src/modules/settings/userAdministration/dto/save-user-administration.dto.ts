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

  @ApiProperty({ maxLength: 100 })
  @TrimmedString(100)
  @IsNotEmpty()
  usrDisplayName!: string;

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
    value === '' || value === undefined ? undefined : value === null ? null : value,
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
