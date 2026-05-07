import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  OptionalQueryBoolean,
  OptionalQueryInt,
  OptionalTrimmedString,
  OptionalUpperString,
} from '../../dto/dtoDecorators';

export class ListBranchMasterQueryDto {
  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    example: '018e1b2c-3d4e-7f8a-9b0c-1d2e3f4a5b6c',
  })
  @OptionalTrimmedString()
  @IsUUID('all')
  compId?: string;

  @ApiPropertyOptional({ maxLength: 2 })
  @OptionalUpperString(2)
  brStateCode?: string;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  brIsActive?: boolean;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  brIsDefault?: boolean;

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
