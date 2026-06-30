import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import {
  NullableIntegerNaN,
  NullableString,
  OptionalBoolean,
  OptionalIntegerArray,
  OptionalNumber,
  OptionalUuid,
  RequiredUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';

export class SaveAreaDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing area',
  })
  @OptionalUuid()
  armId?: string;

  @ApiProperty({ maxLength: 150 })
  @TrimmedString(150)
  @IsNotEmpty()
  armName!: string;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  armAlias?: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableString(50)
  armShort?: string | null;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  armCityId!: string;

  @ApiPropertyOptional({ default: 0 })
  @OptionalNumber()
  armSort?: number;

  @ApiPropertyOptional({ nullable: true })
  @NullableIntegerNaN(0)
  armDistanceKm?: number | null;

  @ApiPropertyOptional({ type: [Number], description: 'Collection days as integer array' })
  @OptionalIntegerArray()
  armCollectionDays?: number[];

  @ApiPropertyOptional({ nullable: true, description: 'Free-text description' })
  @NullableString()
  armDescription?: string | null;

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
