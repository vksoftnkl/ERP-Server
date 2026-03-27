import { ApiPropertyOptional } from '@nestjs/swagger';
import { WidgetPlatform } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const toOptionalNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : (value as number);
};

const toOptionalBoolean = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
      return true;
    }

    if (['0', 'false', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }

  return value as boolean;
};

export class ListWidgetQueryDto {
  @ApiPropertyOptional({ minimum: 0, description: 'Filter widgets by group id / widget tree root' })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsInt()
  @Min(0)
  widgetGroupId?: number;

  @ApiPropertyOptional({ enum: WidgetPlatform, enumName: 'WidgetPlatform' })
  @IsOptional()
  @IsEnum(WidgetPlatform)
  widgetType?: WidgetPlatform;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  widgetVisibility?: boolean;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
