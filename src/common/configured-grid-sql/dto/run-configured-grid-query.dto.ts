import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumberString, IsOptional, IsString, Matches } from 'class-validator';
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

  @ApiPropertyOptional({
    description: 'JSON parameters object to pass dynamic filter values',
    example: '{"branch_id":1,"company_id":2}',
  })
  @IsOptional()
  @IsString()
  grid_param?: string;

  @ApiPropertyOptional({ description: 'Column field name to sort by', example: 'created_at' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z_][a-z0-9_$]*$/i, { message: 'sort_by must be a valid identifier' })
  sort_by?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], description: 'Sort direction', default: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sort_dir?: 'asc' | 'desc';
}
