import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumberString, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { toOptionalTrimmedString, toOptionalInteger } from '../../dto/DtoTransforms';
import { OptionalQueryInt, OptionalTrimmedString } from '../../dto/dtoDecorators';

export class RunConfiguredGridQueryDto {
  @ApiProperty({ description: 'Numeric grid id', example: '1' })
  @IsNumberString({ no_symbols: true })
  grid_id!: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @OptionalTrimmedString(200)
  search?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @OptionalQueryInt(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @OptionalQueryInt(1, 100)
  limit?: number;
}
