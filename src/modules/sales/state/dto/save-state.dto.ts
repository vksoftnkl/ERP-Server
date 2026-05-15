import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import {
  NullableString,
  OptionalBoolean,
  OptionalNumber,
  OptionalUuid,
  TrimmedString,
} from '../../dto/dtoDecorators';

export class SaveStateDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing state',
  })
  @OptionalUuid()
  stmId?: string;

  @ApiProperty({ maxLength: 150 })
  @TrimmedString(150)
  @IsNotEmpty()
  stmName!: string;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  stmAlias?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  stmShort?: string | null;

  @ApiPropertyOptional({ default: 0 })
  @OptionalNumber()
  stmOrder?: number;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  stmIsActive?: boolean;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  stmCreatedBy?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  stmModifiedBy?: string | null;
}
