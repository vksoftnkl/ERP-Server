import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  NullableIntegerNaN,
  NullableString,
  OptionalBoolean,
  OptionalNumber,
} from '../../dto/dtoDecorators';

export class SaveAreaDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing area',
  })
  @IsOptional()
  @IsUUID('all')
  armId?: string;
  @ApiProperty({ maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  armName!: string;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  armAlias?: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableString(50)
  armShort?: string | null;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('all')
  armCityId!: string;

  @ApiPropertyOptional({ default: 0 })
  @OptionalNumber()
  armSort?: number;

  @ApiPropertyOptional({ nullable: true })
  @NullableIntegerNaN(0)
  armDistanceKm?: number | null;

  @ApiPropertyOptional({ type: [Number], description: 'Collection days as integer array' })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  armCollectionDays?: number[];

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  armIsActive?: boolean;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  armCreatedBy?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  armModifiedBy?: string | null;
}
