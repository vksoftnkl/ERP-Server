import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { toNullableString, toOptionalInteger } from 'src/common/dto/dto-transforms';
import { WidgetPlatform } from '../types/widget-master-api.types';

const toRequiredTrimmedString = (value: unknown): string => {
  if (typeof value !== 'string') {
    return value as string;
  }

  return value.trim();
};

/** A single field under a section. When `fieldId` is present the field is updated, otherwise created. */
export class SaveWidgetFieldDto {
  @ApiPropertyOptional({
    description: 'When provided, updates the existing field; otherwise a new field is created',
    example: 1,
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalInteger(value))
  @IsInt()
  @Min(1)
  fieldId?: number;

  @ApiProperty({ maxLength: 255, description: 'Internal binding key / SQL field name' })
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fieldName!: string;

  @ApiPropertyOptional({ maxLength: 255, nullable: true, description: 'Label rendered in the tree' })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(255)
  fieldGuiName?: string | null;

  @ApiPropertyOptional({ maxLength: 255, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(255)
  fieldSecondaryText?: string | null;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalInteger(value))
  @IsInt()
  @Min(0)
  fieldPosition?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  fieldVisibility?: boolean;
}

/** Upsert a section plus its nested fields. When `sectionId` is present the section is updated. */
export class SaveWidgetDto {
  @ApiPropertyOptional({
    description: 'When provided, request updates the existing section',
    example: 1,
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalInteger(value))
  @IsInt()
  @Min(1)
  sectionId?: number;

  @ApiProperty({ example: 1, minimum: 1, description: 'Menu/screen this section belongs to' })
  @Transform(({ value }) => toOptionalInteger(value))
  @IsInt()
  @Min(1)
  sectionMenuId!: number;

  @ApiProperty({ maxLength: 255, description: 'Shown in the "Widget" column' })
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  sectionName!: string;

  @ApiProperty({ maxLength: 255, description: 'Display name shown in the "Widget" column' })
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  sectionGuiName!: string;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalInteger(value))
  @IsInt()
  @Min(0)
  sectionPosition?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  sectionVisibility?: boolean;

  @ApiProperty({ enum: WidgetPlatform, enumName: 'WidgetPlatform' })
  @IsEnum(WidgetPlatform)
  sectionPlatform!: WidgetPlatform;

  @ApiPropertyOptional({ type: SaveWidgetFieldDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveWidgetFieldDto)
  fields?: SaveWidgetFieldDto[];
}
