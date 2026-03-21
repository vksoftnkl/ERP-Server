import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

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

export class GetMenuQueryDto {
  @ApiPropertyOptional({
    description: 'Fetch a specific menu id. If omitted, menus are returned by parentId.',
    minimum: 0,
    example: 1,
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsInt()
  @Min(0)
  menuId?: number;

  @ApiPropertyOptional({
    description: 'Fetch menus under this parent. If omitted, top-level menus are returned.',
    minimum: 0,
    example: 1,
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsInt()
  @Min(0)
  parentId?: number;

  @ApiPropertyOptional({
    type: Boolean,
    default: true,
    description: 'Include nested child menus recursively',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  includeChildren?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    default: true,
    description: 'Return only active menus',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  activeOnly?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    default: true,
    description: 'Return only visible menus',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  visibleOnly?: boolean;
}

