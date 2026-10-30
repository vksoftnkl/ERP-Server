import { IsNotEmpty, IsOptional, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  OptionalBoolean,
  OptionalTrimmedString,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';
import { toOptionalIdString } from 'src/common/dto/DtoTransforms';
export class SaveTenderTypeMasterDto {
  @ApiPropertyOptional({
    example: '1',
    description: 'When provided, request updates the existing tender type',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalIdString(value))
  @Matches(/^\d+$/)
  ttmTypeId?: string;

  @ApiProperty({ maxLength: 50, example: 'CASH' })
  @TrimmedString(50)
  @IsNotEmpty()
  ttmTypeName!: string;

  @ApiPropertyOptional({
    maxLength: 50,
    example: 'Cash',
    description: 'POS-facing label. Defaults to ttmTypeName when omitted.',
  })
  @OptionalTrimmedString(50)
  ttmDisplayName?: string;

  @ApiPropertyOptional()
  @OptionalBoolean()
  ttmIsActive?: boolean;
}
