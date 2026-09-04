import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumberString, IsOptional, IsString } from 'class-validator';
import { OptionalQueryInt, OptionalTrimmedString } from '../../../common/dto/dtoDecorators';

export class RunDropdownQueryDto {
  @ApiProperty({ description: 'Numeric dropdown id', example: '1' })
  @IsNumberString({ no_symbols: true })
  dropdown_id!: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @OptionalTrimmedString(200)
  search?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @OptionalQueryInt(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @OptionalQueryInt(1, 100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'JSON parameters object to pass dynamic filter values',
    example: '{"branch_id":1,"company_id":2}',
  })
  @IsOptional()
  @IsString()
  dropdown_param?: string;
}
