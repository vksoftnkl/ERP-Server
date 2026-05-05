import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const toNullableString = (value: unknown): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export class SaveEmployeeDesignationMasterDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing employee designation',
  })
  @IsOptional()
  @IsUUID('all')
  edId?: string;

  @ApiProperty({ maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  edName!: string;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(50)
  edCode?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  edIsDefault?: boolean;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(250)
  edRemarks?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  edIsActive?: boolean;
}
