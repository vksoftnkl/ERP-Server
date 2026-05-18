import { IsNotEmpty, IsOptional, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalBoolean, TrimmedString } from '../../dto/dtoDecorators';
import { toOptionalIdString } from '../../dto/DtoTransforms';
export class SaveTenderTypeMasterDto {
  @ApiPropertyOptional({
    example: '1',
    description: 'When provided, request updates the existing tender type',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalIdString(value))
  @Matches(/^\d+$/)
  ttmTypeId?: string;

  @ApiProperty({ maxLength: 150 })
  @TrimmedString(150)
  @IsNotEmpty()
  ttmTypeName!: string;

  @ApiPropertyOptional()
  @OptionalBoolean()
  ttmIsActive?: boolean;
}