import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiHideProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableString,
  NullableUuid,
  OptionalBoolean,
  OptionalInteger,
  OptionalNumber,
  OptionalTrimmedString,
  OptionalUuid,
  toNullableString,
  toNullableUuid,
  toOptionalBoolean,
  toOptionalInteger,
  toOptionalUuid,
  toTrimmedString,
} from 'src/common/dto/dtoDecorators';
import { resolveAliasValue } from 'src/common/dto/dto-transforms';

export class SaveGodownDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the godown location',
  })
  @IsOptional()
  @Transform(({ value, obj }) => toOptionalUuid(resolveAliasValue(value, obj, ['gdl_location_id'])))
  @IsUUID('all')
  gdl_id?: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'Required for updateional for update' })
  @IsOptional()
  @Transform(({ value, obj }) => toOptionalUuid(resolveAliasValue(value, obj, ['godown_id'])))
  @IsUUID('all')
  gdl_godown_id?: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'Required for create, optional for update' })
  @IsOptional()
  @Transform(({ value, obj }) => toOptionalUuid(resolveAliasValue(value, obj, ['branch_id'])))
  @IsUUID('all')
  gdl_branch_id?: string;
  @ApiPropertyOptional({ description: 'Required for create, optional for update' })
  @IsOptional()
  @Transform(({ value, obj }) => toTrimmedString(resolveAliasValue(value, obj, ['godown_name'])))
  @IsString()
  @MaxLength(200)
  gdl_name?: string;
  @ApiPropertyOptional({ nullable: true, maxLength: 50 })
  @IsOptional()
  @Transform(({ value, obj }) =>
    toNullableString(resolveAliasValue(value, obj, ['godown_short', 'godown_alias'])),
  )
  @IsString()
  @MaxLength(50)
  gdl_short?: string | null;
  @ApiPropertyOptional({ nullable: true, maxLength: 30 })
  @IsOptional()
  @Transform(({ value, obj }) => toNullableString(resolveAliasValue(value, obj, ['godown_code'])))
  @IsString()
  @MaxLength(30)
  gdl_code?: string | null;
  @ApiPropertyOptional({ maxLength: 20, default: 'BIN' })
  @OptionalTrimmedString(20)
  gdl_type?: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @Transform(({ value, obj }) => toNullableUuid(resolveAliasValue(value, obj, ['parent_id'])))
  @IsUUID('all')
  gdl_parent_id?: string | null;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Transform(({ value, obj }) => toOptionalInteger(resolveAliasValue(value, obj, ['godown_sort'])))
  @IsInt()
  gdl_sort?: number;
  @ApiPropertyOptional({ default: 0 })
  @OptionalInteger()
  gdl_level?: number;
  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  gdl_del_sheet?: boolean;
  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  gdl_split_stock?: boolean;
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value, obj }) => toOptionalBoolean(resolveAliasValue(value, obj, ['is_active'])))
  @IsBoolean()
  gdl_is_active?: boolean;
  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  gdl_negative_stock?: boolean;
  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  gdl_volume?: number;
  @ApiPropertyOptional({ nullable: true, maxLength: 250 })
  @IsOptional()
  @Transform(({ value, obj }) =>
    toNullableString(resolveAliasValue(value, obj, ['godown_description'])),
  )
  @IsString()
  @MaxLength(250)
  gdl_remarks?: string | null;
  @ApiHideProperty()
  @OptionalUuid()
  godown_id?: string;
  @ApiHideProperty()
  @OptionalTrimmedString(200)
  godown_name?: string;
  @ApiHideProperty()
  @NullableString(30)
  godown_code?: string | null;
  @ApiHideProperty()
  @NullableString(50)
  godown_alias?: string | null;
  @ApiHideProperty()
  @NullableString(50)
  godown_short?: string | null;
  @ApiHideProperty()
  @NullableString(250)
  godown_description?: string | null;
  @ApiHideProperty()
  @OptionalInteger()
  godown_sort?: number;

  @ApiHideProperty()
  @OptionalUuid()
  branch_id?: string;

  @ApiHideProperty()
  @NullableUuid()
  parent_id?: string | null;

  @ApiHideProperty()
  @OptionalBoolean()
  is_active?: boolean;

  @ApiHideProperty()
  @OptionalUuid()
  gdl_location_id?: string;
}
