import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  OptionalQueryBoolean,
  OptionalQueryInt,
  OptionalUpperString,
} from 'src/common/dto/dtoDecorators';

export class ListCompanyMasterQueryDto {
  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  compIsActive?: boolean;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  compDefault?: boolean;

  @ApiPropertyOptional({ maxLength: 2 })
  @OptionalUpperString(2)
  compStateCode?: string;

  @ApiPropertyOptional({ maxLength: 150 })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  search?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @OptionalQueryInt(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @OptionalQueryInt(1, 100)
  limit?: number;
}
