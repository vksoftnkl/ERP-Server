import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WidgetPlatform } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { toNullableString, toOptionalInteger } from 'src/common/dto/dto-transforms';


const toRequiredTrimmedString = (value: unknown): string => {
  if (typeof value !== 'string') {
    return value as string;
  }

  return value.trim();
};


export class SaveWidgetDto {
  @ApiPropertyOptional({
    description: 'When provided, request updates the existing widget',
    example: 1,
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalInteger(value))
  @IsInt()
  @Min(1)
  widgetNo?: number;

  @ApiProperty({ example: 1, minimum: 0 })
  @Transform(({ value }) => toOptionalInteger(value))
  @IsInt()
  @Min(0)
  widgetGroupId!: number;

  @ApiProperty({ maxLength: 255 })
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  widgetName!: string;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalInteger(value))
  @IsInt()
  @Min(0)
  widgetPosition?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  widgetVisibility?: boolean;

  @ApiPropertyOptional({ maxLength: 255, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(255)
  widgetGuiName?: string | null;

  @ApiProperty({ enum: WidgetPlatform, enumName: 'WidgetPlatform' })
  @IsEnum(WidgetPlatform)
  widgetType!: WidgetPlatform;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  widgetSecondaryText?: string | null;
}
