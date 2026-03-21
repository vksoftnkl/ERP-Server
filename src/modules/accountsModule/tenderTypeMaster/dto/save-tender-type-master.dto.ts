import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const toOptionalNumericString = (value: unknown): string | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return String(value).trim();
};

export class SaveTenderTypeMasterDto {
  @ApiPropertyOptional({
    example: '1',
    description: 'When provided, request updates the existing tender type',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumericString(value))
  @Matches(/^\d+$/)
  ttmTypeId?: string;

  @ApiProperty({ maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  ttmTypeName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ttmIsActive?: boolean;
}
